import {
  CommandReplay,
  Game,
  MAP_SIZE,
  applyCommand,
  clamp,
  clockTick,
  type ChampionBehavior,
  type ChampionUnit,
  type GameCommand,
  type GameEventRecord,
  type GameSetup,
  type MatchClock,
  type Order,
  SIM_TICK_RATE,
  type Team,
  type TimedCommand,
} from '@macrogod/shared';
import { describeEvent } from './eventFeed';
import { buildHudSnapshot, type CommandMode, type FeedEntry, type HudSnapshot, type RadialTarget } from './hudSnapshot';
import type { MatchSync } from './MatchSync';

type Listener = () => void;
type EventHandler = (events: GameEventRecord[]) => void;
type FrameHandler = (alpha: number, realDt: number) => void;

const HUD_REFRESH_MS = 100;
/** Simulation time allowed per animation frame when running behind (tab in background...). */
const FRAME_STEP_BUDGET_MS = 12;
/** Slice of a catch-up between two yields to the browser. */
const CATCH_UP_SLICE_MS = 40;
/** Real seconds of lag (tab in background, sleep...) beyond which the game is rebuilt behind a loader instead of fast-forwarded. */
const RESYNC_LAG_SEC = 2;
const FEED_SIZE = 7;

const clampToMap = (v: number) => clamp(v, 0, MAP_SIZE);

/** A click beside the map gives a point outside it: keep orders on the map (the server refuses others). */
function onMap(order: Order): Order {
  if (!('pos' in order)) return order;
  return { ...order, pos: { x: clampToMap(order.pos.x), y: clampToMap(order.pos.y) } };
}

export interface SessionOptions {
  setup: GameSetup;
  /** Real-time schedule of the match (shared with the server). */
  clock: MatchClock;
  /** Server time minus local time, to read the clock in server time. */
  serverOffsetMs: number;
  /** Commands already given in this match, replayed to rebuild the game. */
  log?: readonly TimedCommand[];
  /** Saves commands and clock changes as they happen (null = offline). */
  sync?: MatchSync | null;
}

/**
 * Client-side owner of a match: runs the fixed-step simulation on requestAnimationFrame,
 * holds the player's UI state (selection, command mode, speed) and publishes HUD snapshots.
 * The game follows a wall-clock schedule: it is where it should be at this time, whether the page
 * stayed open or not. Commands are saved as they are given, so a reload replays to the same state.
 * The renderer and the input controller plug in through onFrame / onEvents.
 */
export class GameSession {
  readonly game: Game;
  readonly team: Team = 'blue';
  readonly selection = new Set<number>();
  commandMode: CommandMode = 'none';
  /** Where the quick action ring is open (unit or map point). */
  radial: RadialTarget | null = null;

  private clock: MatchClock;
  private readonly serverOffsetMs: number;
  private readonly replay: CommandReplay;
  private readonly sync: MatchSync | null;
  private stopped = false;
  /** Progress (0-1) while the game is being rebuilt behind the loader, null when live. */
  private catchUpProgress: number | null = null;
  private lastFrame = 0;
  private lastHud = 0;
  private raf = 0;
  private feed: FeedEntry[] = [];
  private feedId = 0;
  private snapshot: HudSnapshot;
  private readonly listeners = new Set<Listener>();
  private readonly eventHandlers = new Set<EventHandler>();
  private readonly frameHandlers = new Set<FrameHandler>();

  constructor({ setup, clock, serverOffsetMs, log = [], sync = null }: SessionOptions) {
    this.game = new Game(setup);
    this.clock = clock;
    this.serverOffsetMs = serverOffsetMs;
    this.replay = new CommandReplay(this.game, log);
    this.sync = sync;
    this.snapshot = this.buildSnapshot();
  }

  get speed(): number {
    return this.clock.speed;
  }

  get paused(): boolean {
    return this.clock.paused;
  }

  // --- Clock ---

  private serverNow(): number {
    return Date.now() + this.serverOffsetMs;
  }

  /** Tick (fractional) the game should be at right now. */
  private targetTick(): number {
    return clockTick(this.clock, this.serverNow());
  }

  /** Steps toward `target` (replaying logged commands on the way) for at most `budgetMs`. */
  private advance(target: number, budgetMs: number) {
    const deadline = performance.now() + budgetMs;
    while (!this.game.state.winner && this.game.state.tick + 1 <= target) {
      this.replay.step();
      if (performance.now() >= deadline) break;
    }
  }

  get catchingUp(): boolean {
    return this.catchUpProgress !== null;
  }

  /**
   * Rebuilds the game up to now: replays the command log and the time spent away, in slices
   * so the page stays responsive. Visual effects are skipped (only the victory goes through);
   * the feed keeps the latest events.
   */
  async catchUp(onProgress?: (ratio: number) => void) {
    const target = () => Math.max(this.targetTick(), this.replay.lastTick);
    this.catchUpProgress = 0;
    while (!this.stopped && !this.game.state.winner && this.game.state.tick + 1 <= target()) {
      this.advance(target(), CATCH_UP_SLICE_MS);
      this.flushCatchUpEvents();
      this.catchUpProgress = this.game.state.tick / target();
      onProgress?.(this.catchUpProgress);
      this.publish();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    this.replay.applyDue();
    this.flushCatchUpEvents();
    this.catchUpProgress = null;
    this.publish();
  }

  private flushCatchUpEvents() {
    const events = this.game.drainEvents();
    this.pushFeed(events);
    const end = events.filter((e) => e.type === 'victory');
    if (end.length > 0) for (const handler of this.eventHandlers) handler(end);
  }

  /** Too far behind (the tab was hidden): pause rendering and rebuild behind the loader. */
  private async resync() {
    cancelAnimationFrame(this.raf);
    await this.catchUp();
    if (!this.stopped) this.start();
  }

  start() {
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    const realDt = Math.min((now - this.lastFrame) / 1000, 0.25);
    this.lastFrame = now;

    const target = this.targetTick();
    if (!this.game.state.winner && target - this.game.state.tick > RESYNC_LAG_SEC * this.clock.speed * SIM_TICK_RATE) {
      void this.resync();
      return;
    }
    this.advance(target, FRAME_STEP_BUDGET_MS);

    const events = this.game.drainEvents();
    if (events.length > 0) {
      this.pushFeed(events);
      for (const handler of this.eventHandlers) handler(events);
    }

    const alpha = this.game.state.winner ? 1 : clamp(target - this.game.state.tick, 0, 1);
    for (const handler of this.frameHandlers) handler(alpha, realDt);

    if (now - this.lastHud >= HUD_REFRESH_MS) {
      this.lastHud = now;
      this.publish();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private pushFeed(events: GameEventRecord[]) {
    for (const e of events) {
      const entry = describeEvent(this.game, e, this.team);
      if (entry) this.feed = [...this.feed, { ...entry, id: ++this.feedId }].slice(-FEED_SIZE);
    }
  }

  // --- HUD store (useSyncExternalStore) ---

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private buildSnapshot(): HudSnapshot {
    return buildHudSnapshot(this.game, this.team, this.snapshot, {
      speed: this.speed,
      paused: this.paused,
      catchUp: this.catchUpProgress,
      selection: this.selection,
      commandMode: this.commandMode,
      radial: this.radial,
      feed: this.feed,
    });
  }

  /** Rebuilds the snapshot now (after a player action) instead of waiting for the next tick. */
  publish() {
    this.snapshot = this.buildSnapshot();
    for (const l of this.listeners) l();
  }

  onEvents(handler: EventHandler) {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  onFrame(handler: FrameHandler) {
    this.frameHandlers.add(handler);
    return () => {
      this.frameHandlers.delete(handler);
    };
  }

  // --- Selection ---

  myChampions(): ChampionUnit[] {
    return this.game.state.champions.filter((c) => c.team === this.team);
  }

  selectedChampions(): ChampionUnit[] {
    return this.myChampions().filter((c) => this.selection.has(c.id));
  }

  select(ids: number[], additive = false) {
    if (!additive) this.selection.clear();
    for (const id of ids) {
      if (additive && this.selection.has(id) && ids.length === 1) this.selection.delete(id);
      else this.selection.add(id);
    }
    this.publish();
  }

  selectAll() {
    this.select(this.myChampions().map((c) => c.id));
  }

  clearSelection() {
    this.selection.clear();
    this.publish();
  }

  // --- Commands ---

  openRadial(target: RadialTarget) {
    this.radial = this.selection.size > 0 ? target : null;
    this.commandMode = 'none';
    this.publish();
  }

  closeRadial() {
    if (this.radial === null) return;
    this.radial = null;
    this.publish();
  }

  setCommandMode(mode: CommandMode) {
    this.commandMode = this.selection.size > 0 ? mode : 'none';
    this.publish();
  }

  /** Applies a command now and saves it with the current tick, so a replay applies it at the same moment. */
  private execute(command: GameCommand) {
    // While catching up the game is not at "now": a command would be stamped in the past.
    if (command.championIds.length === 0 || this.catchingUp) return;
    applyCommand(this.game, command);
    this.sync?.command(this.game.state.tick, command);
  }

  /** Sends an order to the given champions (default: the selection). */
  order(order: Order, ids: Iterable<number> = this.selection) {
    this.execute({ type: 'order', championIds: [...ids], order: onMap(order) });
    this.commandMode = 'none';
    this.radial = null;
    this.publish();
  }

  /** Champions a behaviour toggle applies to: the selection, or the whole team when nothing is selected. */
  behaviorTargets(): ChampionUnit[] {
    return this.selection.size > 0 ? this.selectedChampions() : this.myChampions();
  }

  /** Flips a behaviour for the targets (all ON unless they already all are). */
  toggleBehavior(key: keyof ChampionBehavior) {
    const targets = this.behaviorTargets();
    const enable = !targets.every((c) => c[key]);
    this.execute({ type: 'behavior', championIds: targets.map((c) => c.id), behavior: { [key]: enable } });
    this.publish();
  }

  /** Re-anchors the schedule where the game stands now, with the new speed / pause. */
  private setClock(speed: number, paused: boolean) {
    const tick = this.targetTick();
    this.clock = { tick, at: this.serverNow(), speed, paused };
    this.sync?.clock(this.clock);
    this.publish();
  }

  setSpeed(speed: number) {
    this.setClock(speed, false);
  }

  togglePause() {
    this.setClock(this.clock.speed, !this.clock.paused);
  }
}
