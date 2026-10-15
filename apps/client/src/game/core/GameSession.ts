import {
  DEFAULT_TIME_SCALE,
  Game,
  SIM_DT,
  type ChampionBehavior,
  type ChampionUnit,
  type GameEventRecord,
  type GameSetup,
  type Order,
  type Team,
} from '@macrogod/shared';
import { describeEvent } from './eventFeed';
import { buildHudSnapshot, type CommandMode, type FeedEntry, type HudSnapshot, type RadialTarget } from './hudSnapshot';

type Listener = () => void;
type EventHandler = (events: GameEventRecord[]) => void;
type FrameHandler = (alpha: number, realDt: number) => void;

const HUD_REFRESH_MS = 100;
const MAX_STEPS_PER_FRAME = 40;
const FEED_SIZE = 7;

/**
 * Client-side owner of a match: runs the fixed-step simulation on requestAnimationFrame,
 * holds the player's UI state (selection, command mode, speed) and publishes HUD snapshots.
 * The renderer and the input controller plug in through onFrame / onEvents.
 */
export class GameSession {
  readonly game: Game;
  readonly team: Team = 'blue';
  readonly selection = new Set<number>();
  commandMode: CommandMode = 'none';
  /** Where the quick action ring is open (unit or map point). */
  radial: RadialTarget | null = null;
  speed = DEFAULT_TIME_SCALE;
  paused = false;

  private accumulator = 0;
  private lastFrame = 0;
  private lastHud = 0;
  private raf = 0;
  private feed: FeedEntry[] = [];
  private feedId = 0;
  private snapshot: HudSnapshot;
  private readonly listeners = new Set<Listener>();
  private readonly eventHandlers = new Set<EventHandler>();
  private readonly frameHandlers = new Set<FrameHandler>();

  constructor(setup: GameSetup) {
    this.game = new Game(setup);
    this.snapshot = this.buildSnapshot();
  }

  start() {
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    const realDt = Math.min((now - this.lastFrame) / 1000, 0.25);
    this.lastFrame = now;

    if (!this.paused && !this.game.state.winner) {
      this.accumulator += realDt * this.speed;
      let steps = 0;
      while (this.accumulator >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
        this.game.step();
        this.accumulator -= SIM_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    const events = this.game.drainEvents();
    if (events.length > 0) {
      this.pushFeed(events);
      for (const handler of this.eventHandlers) handler(events);
    }

    const alpha = this.paused ? 1 : Math.min(1, this.accumulator / SIM_DT);
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
    return buildHudSnapshot(this.game, this.team, {
      speed: this.speed,
      paused: this.paused,
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

  /** Sends an order to the given champions (default: the selection). */
  order(order: Order, ids: Iterable<number> = this.selection) {
    for (const id of ids) this.game.issueOrder(id, order);
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
    for (const c of targets) this.game.setBehavior(c.id, { [key]: enable });
    this.publish();
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.paused = false;
    this.publish();
  }

  togglePause() {
    this.paused = !this.paused;
    this.publish();
  }
}
