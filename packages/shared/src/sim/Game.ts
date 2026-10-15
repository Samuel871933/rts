import { SIM_DT } from '../constants';
import { WAVE_RULES } from '../data/minions';
import { STRUCTURES } from '../data/structures';
import type { Vec2 } from '../math';
import { LANES, TEAMS, type ChampionPick, type Lane, type Role, type Team } from '../types';
import { createChampion, createStructure } from './factory';
import { getNavGrid, type NavGrid } from './nav/NavGrid';
import { createRng, type Rng } from './rng';
import { SpatialGrid } from './SpatialGrid';
import { updateAttacks } from './systems/combat';
import { createCamps, updateCamps, updateMonsters } from './systems/camps';
import { applyOrder, fountainSpot, updateChampions } from './systems/champions';
import { updateMinions } from './systems/minions';
import { updateMovement } from './systems/movement';
import { autoBuy, recomputeChampionStats } from './systems/progression';
import { updateStructures } from './systems/structures';
import { updateVision } from './systems/vision';
import { updateWaves } from './systems/waves';
import type {
  ChampionBehavior,
  ChampionUnit,
  GameEvent,
  GameEventRecord,
  GameState,
  MinionUnit,
  Order,
  StructureUnit,
  Unit,
} from './types';

export interface GameSetup {
  seed: number;
  teams: Record<Team, ChampionPick[]>;
  /** Give each champion the lane / jungle job of its role at start (default true). */
  autoAssignRoles?: boolean;
}

export function defaultOrderForRole(role: Role): Order {
  switch (role) {
    case 'top':
      return { type: 'lane', lane: 'top' };
    case 'mid':
      return { type: 'lane', lane: 'mid' };
    case 'jungle':
      return { type: 'jungle', scope: 'own' };
    case 'bot':
    case 'support':
      return { type: 'lane', lane: 'bot' };
  }
}

const VISION_EVERY_TICKS = 3;

/**
 * Authoritative, deterministic simulation of one match. Pure logic: no DOM, no timers.
 * Call step() at a fixed rate (SIM_TICK_RATE per game second); read `state` to render.
 */
export class Game {
  readonly state: GameState;
  readonly nav: NavGrid = getNavGrid();
  readonly rng: Rng;
  private readonly grid = new SpatialGrid<Unit>(400);
  /** Alive minions per team and lane, rebuilt each tick (plus the ones spawned during it). */
  private readonly laneMinions = {} as Record<Team, Record<Lane, MinionUnit[]>>;
  private events: GameEventRecord[] = [];
  private nextId = 1;

  constructor(setup: GameSetup) {
    this.rng = createRng(setup.seed);
    this.state = {
      time: 0,
      tick: 0,
      units: new Map(),
      champions: [],
      structures: [],
      camps: createCamps(),
      teams: {
        blue: { kills: 0, structuresDestroyed: 0, dragons: 0, barons: 0, gold: 0 },
        red: { kills: 0, structuresDestroyed: 0, dragons: 0, barons: 0, gold: 0 },
      },
      wave: { number: 0, nextAt: WAVE_RULES.firstWaveAt, queue: [] },
      winner: null,
      firstBlood: false,
    };
    this.spawnStructures();
    for (const team of TEAMS) this.spawnTeam(team, setup.teams[team], setup.autoAssignRoles ?? true);
    this.rebuildGrid();
    updateVision(this);
  }

  private spawnStructures() {
    const byDefId = new Map<string, StructureUnit>();
    for (const def of STRUCTURES) {
      const s = this.add(createStructure(this.allocateId(), def));
      this.state.structures.push(s);
      byDefId.set(def.id, s);
    }
    for (const def of STRUCTURES) {
      byDefId.get(def.id)!.protectedBy = def.protectedBy.map((id) => byDefId.get(id)!.id);
    }
  }

  private spawnTeam(team: Team, picks: ChampionPick[], autoAssign: boolean) {
    picks.forEach((pick, index) => {
      const c = createChampion(this.allocateId(), pick, team, { x: 0, y: 0 });
      c.pos = fountainSpot(c, index);
      c.prevPos = { ...c.pos };
      this.add(c);
      this.state.champions.push(c);
      recomputeChampionStats(this, c);
      c.hp = c.maxHp;
      autoBuy(this, c);
      c.homeOrder = defaultOrderForRole(pick.role);
      if (autoAssign) applyOrder(this, c, c.homeOrder);
    });
  }

  allocateId(): number {
    return this.nextId++;
  }

  add<T extends Unit>(unit: T): T {
    this.state.units.set(unit.id, unit);
    if (unit.kind === 'minion') this.laneMinions[unit.team]?.[unit.lane].push(unit);
    return unit;
  }

  /** Alive minions of a team in a lane (as of this tick). */
  minionsOf(team: Team, lane: Lane): readonly MinionUnit[] {
    return this.laneMinions[team][lane];
  }

  get(id: number): Unit | undefined {
    return this.state.units.get(id);
  }

  champion(id: number): ChampionUnit | undefined {
    const u = this.state.units.get(id);
    return u?.kind === 'champion' ? u : undefined;
  }

  /** Alive units within radius (positions as of the start of the current tick). */
  queryUnits(pos: Vec2, radius: number): Unit[] {
    return this.grid.query(pos, radius);
  }

  emit(event: GameEvent) {
    this.events.push({ ...event, time: this.state.time });
  }

  drainEvents(): GameEventRecord[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  issueOrder(championId: number, order: Order) {
    const c = this.champion(championId);
    if (c) applyOrder(this, c, order);
  }

  setBehavior(championId: number, behavior: Partial<ChampionBehavior>) {
    const c = this.champion(championId);
    if (!c) return;
    if (behavior.autoRetreat !== undefined) c.autoRetreat = behavior.autoRetreat;
    if (behavior.autoReturn !== undefined) c.autoReturn = behavior.autoReturn;
    if (behavior.autoTurretSafety !== undefined) c.autoTurretSafety = behavior.autoTurretSafety;
    if (behavior.autoFarm !== undefined && behavior.autoFarm !== c.autoFarm) {
      c.autoFarm = behavior.autoFarm;
      if (!c.autoFarm) {
        // Farm OFF: drop the lane / jungle job; the champion now only acts on orders.
        if (c.order.type === 'lane' || c.order.type === 'jungle') applyOrder(this, c, { type: 'idle' });
        else c.standingOrder = null;
      } else if (c.homeOrder.type !== 'idle') {
        // Farm ON: back to the usual post (after the current action, if any).
        if (c.order.type === 'idle') applyOrder(this, c, c.homeOrder);
        else c.standingOrder ??= c.homeOrder;
      }
    }
  }

  private rebuildGrid() {
    this.grid.clear();
    for (const team of TEAMS) {
      const lists = (this.laneMinions[team] ??= { top: [], mid: [], bot: [] });
      for (const lane of LANES) lists[lane].length = 0;
    }
    for (const u of this.state.units.values()) {
      if (!u.alive) continue;
      this.grid.insert(u);
      if (u.kind === 'minion') this.laneMinions[u.team][u.lane].push(u);
    }
  }

  step() {
    const s = this.state;
    if (s.winner) return;
    const dt = SIM_DT;

    for (const u of s.units.values()) {
      u.prevPos.x = u.pos.x;
      u.prevPos.y = u.pos.y;
    }
    s.tick++;
    // From the tick count rather than summed: no floating point drift over a long game.
    s.time = s.tick * dt;

    this.rebuildGrid();
    updateWaves(this);
    updateCamps(this);
    updateChampions(this, dt);
    updateMinions(this);
    updateMonsters(this, dt);
    updateStructures(this, dt);
    updateAttacks(this, dt);
    updateMovement(this, dt);
    if (s.tick % VISION_EVERY_TICKS === 0) updateVision(this);
    this.cleanup();
  }

  /** Dead minions / monsters / expired wards leave the world; champions and structures stay. */
  private cleanup() {
    const time = this.state.time;
    for (const [id, u] of this.state.units) {
      if (u.kind === 'ward' && u.alive && time >= u.expiresAt) u.alive = false;
      if (!u.alive && (u.kind === 'minion' || u.kind === 'monster' || u.kind === 'ward')) this.state.units.delete(id);
    }
  }
}
