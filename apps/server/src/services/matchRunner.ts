import {
  CommandReplay,
  Game,
  PLAYER_TEAM,
  SIM_TICK_RATE,
  championSummaries,
  clockTick,
  compareCommands,
  type MatchChampionStats,
  type MatchClock,
  type TimedCommand,
} from '@macrogod/shared';
import { Match } from '../models/Match';
import { MatchCommand } from '../models/MatchCommand';

const TICK_INTERVAL_MS = 1000;
/**
 * The server stays this many real seconds behind the clock, so the player's commands (stamped
 * with the client's tick) almost always arrive before the server passes that tick.
 */
const LAG_SEC = 5;
/** Simulation time per slice before yielding to HTTP requests, and per round for all matches. */
const SLICE_MS = 20;
const ROUND_BUDGET_MS = 500;
/** A late command forces a replay from tick 0: at most one per match in this window. */
const REBUILD_COOLDOWN_MS = 10_000;

interface RunningMatch {
  game: Game;
  log: TimedCommand[];
  replay: CommandReplay;
  clock: MatchClock | null;
}

const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

/** Deduplicated (same seq sent twice) and in replay order. */
export function toCommandLog(rows: MatchCommand[]): TimedCommand[] {
  const bySeq = new Map<number, TimedCommand>();
  for (const r of rows) {
    const seq = r.seq ?? r.id;
    if (!bySeq.has(seq)) bySeq.set(seq, { tick: r.tick, seq, command: r.command });
  }
  return [...bySeq.values()].sort(compareCommands);
}

/**
 * Plays every running match on the server, following its wall clock, so a match goes on (and ends)
 * with no page open. Same deterministic sim as the client: seed + command log = same game.
 * The server is the one that records victories and defeats; the client only watches.
 */
class MatchRunner {
  private readonly runs = new Map<string, RunningMatch>();
  private readonly loading = new Set<string>();
  private readonly lastRebuild = new Map<string, number>();
  private readonly rebuildScheduled = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  /** Round-robin start: every match gets the first slice in turn. */
  private cursor = 0;

  async start() {
    const running = await Match.findAll({ where: { status: 'in_progress' }, attributes: ['id', 'clock'] });
    // One at a time: each load reads a whole command log.
    for (const m of running) if (m.clock) await this.load(m.id);
    this.timer = setInterval(() => {
      this.round().catch((err) => console.error('[runner] tour de simulation en échec', err));
    }, TICK_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** A new command: queue it, or rebuild the match if the server already went past its tick. */
  onCommand(matchId: string, entry: TimedCommand) {
    const run = this.runs.get(matchId);
    if (!run) return;
    if (entry.tick < run.game.state.tick) {
      this.scheduleRebuild(matchId);
      return;
    }
    // Entries before the replay cursor all have a smaller tick: inserting in order keeps it valid.
    let i = run.log.length;
    while (i > 0 && compareCommands(run.log[i - 1], entry) > 0) i--;
    run.log.splice(i, 0, entry);
  }

  onClock(matchId: string, clock: MatchClock) {
    const run = this.runs.get(matchId);
    if (run) run.clock = clock;
    else void this.load(matchId);
  }

  /** The match ended elsewhere (abandon). */
  onFinished(matchId: string) {
    this.runs.delete(matchId);
  }

  /** Where the server's simulation of the match stands (game time, player's champions). */
  progress(matchId: string): { durationSec: number; stats: MatchChampionStats[] } | null {
    const run = this.runs.get(matchId);
    if (!run) return null;
    return { durationSec: Math.floor(run.game.state.time), stats: championSummaries(run.game, PLAYER_TEAM) };
  }

  /** Replays from tick 0 cost a lot: never more than once per cooldown for a match. */
  private scheduleRebuild(matchId: string) {
    this.runs.delete(matchId);
    if (this.rebuildScheduled.has(matchId)) return;
    this.rebuildScheduled.add(matchId);
    const wait = Math.max(0, (this.lastRebuild.get(matchId) ?? 0) + REBUILD_COOLDOWN_MS - Date.now());
    setTimeout(() => {
      this.rebuildScheduled.delete(matchId);
      this.lastRebuild.set(matchId, Date.now());
      void this.load(matchId);
    }, wait);
  }

  private async load(matchId: string) {
    if (this.loading.has(matchId)) return;
    this.loading.add(matchId);
    try {
      const match = await Match.findByPk(matchId);
      if (!match || match.status !== 'in_progress') return;
      const rows = await MatchCommand.findAll({ where: { matchId }, order: [['id', 'ASC']] });
      const log = toCommandLog(rows);
      const game = new Game({
        seed: match.seed,
        teams: { blue: match.composition, red: match.enemyComposition ?? [] },
      });
      this.runs.set(matchId, { game, log, replay: new CommandReplay(game, log), clock: match.clock });
    } catch (err) {
      console.error(`[runner] chargement de la partie ${matchId} impossible`, err);
    } finally {
      this.loading.delete(matchId);
    }
  }

  /**
   * Advances every match toward its clock, in slices so requests keep being served. The round's
   * budget is shared fairly, and one failing match is set aside without stopping the others.
   */
  private async round() {
    if (this.busy) return;
    this.busy = true;
    try {
      const entries = [...this.runs];
      if (entries.length === 0) return;
      this.cursor = (this.cursor + 1) % entries.length;
      const ordered = [...entries.slice(this.cursor), ...entries.slice(0, this.cursor)];
      const share = Math.max(SLICE_MS, ROUND_BUDGET_MS / ordered.length);
      for (const [matchId, run] of ordered) {
        try {
          await this.advance(matchId, run, performance.now() + share);
        } catch (err) {
          console.error(`[runner] partie ${matchId} mise de côté après une erreur`, err);
          this.runs.delete(matchId);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  private async advance(matchId: string, run: RunningMatch, deadline: number) {
    if (!run.clock) return;
    const target = clockTick(run.clock, Date.now()) - LAG_SEC * run.clock.speed * SIM_TICK_RATE;
    while (run.game.state.tick + 1 <= target && !run.game.state.winner && performance.now() < deadline) {
      const sliceEnd = Math.min(deadline, performance.now() + SLICE_MS);
      while (run.game.state.tick + 1 <= target && !run.game.state.winner && performance.now() < sliceEnd) {
        run.replay.step();
      }
      run.game.drainEvents();
      await yieldToEventLoop();
      if (this.runs.get(matchId) !== run) return; // rebuilt or finished meanwhile
    }
    if (run.game.state.winner) await this.finish(matchId, run);
  }

  private async finish(matchId: string, run: RunningMatch) {
    this.runs.delete(matchId);
    const { state } = run.game;
    const [updated] = await Match.update(
      {
        status: state.winner === PLAYER_TEAM ? 'victory' : 'defeat',
        durationSec: Math.floor(state.time),
        stats: championSummaries(run.game, PLAYER_TEAM),
        finishedAt: new Date(),
      },
      { where: { id: matchId, status: 'in_progress' } },
    );
    if (updated > 0) console.log(`[runner] partie ${matchId} terminée (${state.winner}) à ${Math.floor(state.time)} s`);
  }
}

export const matchRunner = new MatchRunner();
