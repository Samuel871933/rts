import {
  CHAMPIONS_BY_ID,
  ITEMS_BY_ID,
  RULES,
  XP_TABLE,
  autoFarmCountdown,
  buildFor,
  LANES,
  enemyOf,
  type Activity,
  type ChampionUnit,
  type Lane,
  type Game,
  type Order,
  type Role,
  type Team,
  type TeamState,
  type Vec2,
} from '@macrogod/shared';

export type CommandMode = 'none' | 'ward' | 'attackMove';

/** What the quick action ring is open on: a unit, a jungle camp out of sight, or a point of the map. */
export type RadialTarget = { kind: 'unit'; id: number } | { kind: 'camp'; campId: string } | { kind: 'ground'; pos: Vec2 };

export interface HudChampion {
  id: number;
  defId: string;
  name: string;
  role: Role;
  level: number;
  xpRatio: number;
  hp: number;
  maxHp: number;
  gold: number;
  items: string[];
  nextItem: { id: string; cost: number } | null;
  alive: boolean;
  /** Seen by the player's team right now (enemy cards hide live info otherwise). */
  visible: boolean;
  respawnIn: number;
  recallRatio: number | null;
  order: Order;
  standingOrder: Order | null;
  /** Seconds before farm auto sends it back to its post (null = it won't). */
  resumeIn: number | null;
  activity: Activity;
  wardCharges: number;
  kills: number;
  deaths: number;
  cs: number;
  autoRetreat: boolean;
  autoReturn: boolean;
  autoFarm: boolean;
  autoTurretSafety: boolean;
  buffs: { blue: boolean; red: boolean; baron: boolean };
}

export interface ObjectiveStatus {
  alive: boolean;
  spawnAt: number | null;
}

export interface LaneStructures {
  lane: Lane;
  /** Outer, inner, inhibitor turret. */
  turrets: boolean[];
  inhibitor: { alive: boolean; respawnIn: number };
}

export interface TeamStructures {
  lanes: LaneStructures[];
  nexusTurrets: number;
  nexus: boolean;
}

export interface FeedEntry {
  id: number;
  time: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'epic';
}

export interface HudSnapshot {
  time: number;
  speed: number;
  paused: boolean;
  /** Progress (0-1) while the game is rebuilt after time away, null when live. */
  catchUp: number | null;
  winner: Team | null;
  champions: HudChampion[];
  enemies: HudChampion[];
  structures: Record<Team, TeamStructures>;
  selection: number[];
  commandMode: CommandMode;
  radial: RadialTarget | null;
  teams: Record<Team, TeamState>;
  objectives: { dragon: ObjectiveStatus; baron: ObjectiveStatus };
  feed: FeedEntry[];
}

/** Shown precision: values that move every tick are rounded so an unchanged card stays the same object. */
const pct = (v: number) => Math.round(v * 100) / 100;
const ceilOrNull = (v: number | null) => (v === null ? null : Math.ceil(v));

function hudChampion(game: Game, c: ChampionUnit, viewer: Team): HudChampion {
  const def = CHAMPIONS_BY_ID[c.defId];
  const time = game.state.time;
  const levelFloor = XP_TABLE[c.level - 1];
  const levelCeil = XP_TABLE[c.level] ?? levelFloor;
  const nextId = buildFor(def.archetype, c.role).find((id) => !c.items.includes(id));
  const recallTotal = c.hasBaron ? RULES.baronRecallDuration : RULES.recallDuration;
  return {
    id: c.id,
    defId: c.defId,
    name: def.name,
    role: c.role,
    level: c.level,
    xpRatio: levelCeil > levelFloor ? pct((c.xp - levelFloor) / (levelCeil - levelFloor)) : 1,
    hp: Math.ceil(c.hp),
    maxHp: Math.round(c.maxHp),
    gold: Math.floor(c.gold),
    items: [...c.items],
    nextItem: nextId ? { id: nextId, cost: ITEMS_BY_ID[nextId].cost } : null,
    alive: c.alive,
    visible: c.team === viewer || c.visible[viewer],
    respawnIn: c.alive ? 0 : Math.ceil(c.respawnTimer),
    recallRatio: c.recallTimer === null ? null : pct(1 - c.recallTimer / recallTotal),
    order: c.order,
    standingOrder: c.standingOrder,
    resumeIn: c.team === viewer ? ceilOrNull(autoFarmCountdown(c, time)) : null,
    activity: c.alive ? c.activity : 'dead',
    wardCharges: c.wardCharges,
    kills: c.stats.kills,
    deaths: c.stats.deaths,
    cs: c.stats.cs,
    autoRetreat: c.autoRetreat,
    autoReturn: c.autoReturn,
    autoFarm: c.autoFarm,
    autoTurretSafety: c.autoTurretSafety,
    buffs: { blue: c.buffs.blue > time, red: c.buffs.red > time, baron: c.buffs.baron > time },
  };
}

function objective(game: Game, campId: string): ObjectiveStatus {
  const camp = game.state.camps.find((c) => c.def.id === campId);
  return { alive: camp?.unitId != null, spawnAt: camp?.nextSpawnAt ?? null };
}

function teamStructures(game: Game, team: Team): TeamStructures {
  const mine = game.state.structures.filter((s) => s.team === team);
  return {
    lanes: LANES.map((lane) => {
      const inLane = mine.filter((s) => s.lane === lane);
      const turret = (tier: string) => inLane.some((s) => s.kind === 'turret' && s.tier === tier && s.alive);
      const inhib = inLane.find((s) => s.kind === 'inhibitor');
      return {
        lane,
        turrets: [turret('outer'), turret('inner'), turret('inhib')],
        inhibitor: { alive: !!inhib?.alive, respawnIn: inhib && !inhib.alive ? Math.ceil(inhib.respawnTimer) : 0 },
      };
    }),
    nexusTurrets: mine.filter((s) => s.kind === 'turret' && s.tier === 'nexus' && s.alive).length,
    nexus: mine.some((s) => s.kind === 'nexus' && s.alive),
  };
}

/** Previous value when the new one is identical: unchanged parts keep their identity (memo, selectors). */
function keep<T>(prev: T | undefined, next: T): T {
  return prev !== undefined && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

/** Same array when every element was kept. */
function keepList<T>(prev: readonly T[] | undefined, next: T[]): T[] {
  const items = next.map((item, i) => keep(prev?.[i], item));
  return prev && prev.length === items.length && items.every((item, i) => item === prev[i]) ? (prev as T[]) : items;
}

/**
 * HUD state for React. Built ~10 times per second: whatever did not change since `prev` is reused
 * as is, so components (and memoized cards) only re-render for what they actually show.
 */
export function buildHudSnapshot(
  game: Game,
  team: Team,
  prev: HudSnapshot | undefined,
  view: {
    speed: number;
    paused: boolean;
    catchUp: number | null;
    selection: Set<number>;
    commandMode: CommandMode;
    radial: RadialTarget | null;
    feed: FeedEntry[];
  },
): HudSnapshot {
  const s = game.state;
  return {
    time: s.time,
    speed: view.speed,
    paused: view.paused,
    catchUp: view.catchUp,
    winner: s.winner,
    champions: keepList(prev?.champions, s.champions.filter((c) => c.team === team).map((c) => hudChampion(game, c, team))),
    enemies: keepList(prev?.enemies, s.champions.filter((c) => c.team === enemyOf(team)).map((c) => hudChampion(game, c, team))),
    structures: keep(prev?.structures, { blue: teamStructures(game, 'blue'), red: teamStructures(game, 'red') }),
    selection: keepList(prev?.selection, [...view.selection]),
    commandMode: view.commandMode,
    radial: view.radial,
    teams: keep(prev?.teams, { blue: { ...s.teams.blue }, red: { ...s.teams.red } }),
    objectives: keep(prev?.objectives, { dragon: objective(game, 'dragon'), baron: objective(game, 'baron') }),
    feed: view.feed,
  };
}
