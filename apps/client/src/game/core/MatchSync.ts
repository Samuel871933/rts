import { compareCommands, type MatchClock, type TimedCommand } from '@macrogod/shared';
import { ApiError } from '../../api/http';
import { matchesApi } from '../../api/endpoints';
import type { MatchLog } from '../../api/types';

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 800;

const isRetryable = (err: unknown) => !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What was given but not acknowledged by the server yet; survives a reload. */
interface Outbox {
  commands: TimedCommand[];
  clock: MatchClock | null;
}

const outboxKey = (matchId: string) => `macrogod:outbox:${matchId}`;

function readOutbox(matchId: string): Outbox {
  try {
    const raw = localStorage.getItem(outboxKey(matchId));
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (data && typeof data === 'object' && Array.isArray((data as Outbox).commands)) {
      const { commands, clock } = data as Outbox;
      return { commands, clock: clock && typeof clock === 'object' ? clock : null };
    }
  } catch {
    // Storage unavailable or corrupted: nothing pending.
  }
  return { commands: [], clock: null };
}

/** The match is over: nothing left to send for it. */
export function clearOutbox(matchId: string) {
  try {
    localStorage.removeItem(outboxKey(matchId));
  } catch {
    // Storage unavailable.
  }
}

function writeOutbox(matchId: string, outbox: Outbox) {
  try {
    if (outbox.commands.length === 0 && !outbox.clock) localStorage.removeItem(outboxKey(matchId));
    else localStorage.setItem(outboxKey(matchId), JSON.stringify(outbox));
  } catch {
    // Storage unavailable: the request itself is still sent.
  }
}

/** Server log + what this browser gave but the server may not have yet (reload right after an order). */
export function mergeWithOutbox(matchId: string, log: MatchLog): { clock: MatchClock | null; commands: TimedCommand[] } {
  const outbox = readOutbox(matchId);
  const known = new Set(log.commands.map((c) => c.seq));
  const commands = [...log.commands, ...outbox.commands.filter((c) => !known.has(c.seq))].sort(compareCommands);
  const clock = outbox.clock && (!log.clock || outbox.clock.at >= log.clock.at) ? outbox.clock : log.clock;
  return { clock, commands };
}

/**
 * Saves the match as it is played. Every command / clock change is written to a local outbox
 * first, then sent right away; it leaves the outbox once the server acknowledges it.
 * After a reload, pending entries are merged into the log and sent again (the server ignores
 * a seq it already has), so an order given just before reloading is never lost.
 */
export class MatchSync {
  private nextSeq: number;

  constructor(
    private readonly matchId: string,
    log: readonly TimedCommand[],
  ) {
    this.nextSeq = log.reduce((max, c) => Math.max(max, c.seq), -1) + 1;
  }

  /** Sends what a previous page left unacknowledged. */
  resendPending() {
    const outbox = readOutbox(this.matchId);
    for (const command of outbox.commands) this.sendCommand(command);
    if (outbox.clock) this.sendClock(outbox.clock);
  }

  command(tick: number, command: TimedCommand['command']) {
    const entry: TimedCommand = { tick, seq: this.nextSeq++, command };
    const outbox = readOutbox(this.matchId);
    outbox.commands.push(entry);
    writeOutbox(this.matchId, outbox);
    this.sendCommand(entry);
  }

  clock(clock: MatchClock) {
    writeOutbox(this.matchId, { ...readOutbox(this.matchId), clock });
    this.sendClock(clock);
  }

  private sendCommand(entry: TimedCommand) {
    void this.send(() => matchesApi.addCommand(this.matchId, entry)).then((result) => {
      if (result === 'offline') return;
      // Saved, or refused for good: either way it must not be resent (nor replayed) again.
      const outbox = readOutbox(this.matchId);
      writeOutbox(this.matchId, { ...outbox, commands: outbox.commands.filter((c) => c.seq !== entry.seq) });
    });
  }

  private sendClock(clock: MatchClock) {
    const { speed, paused } = clock;
    void this.send(() => matchesApi.setClock(this.matchId, { speed, paused })).then((result) => {
      if (result === 'offline') return;
      const outbox = readOutbox(this.matchId);
      // A newer change may have been queued meanwhile: only clear this one.
      if (outbox.clock?.at === clock.at) writeOutbox(this.matchId, { ...outbox, clock: null });
    });
  }

  /** 'saved', 'refused' (the server said no: keeping it would only replay a command it never took), or 'offline'. */
  private async send(request: () => Promise<unknown>): Promise<'saved' | 'refused' | 'offline'> {
    for (let attempt = 1; ; attempt++) {
      try {
        await request();
        return 'saved';
      } catch (err) {
        if (!isRetryable(err)) {
          console.error('Commande refusée par le serveur', err);
          return 'refused';
        }
        if (attempt >= MAX_ATTEMPTS) {
          console.error('Sauvegarde de la partie impossible (serveur injoignable)', err);
          return 'offline';
        }
        await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }
}
