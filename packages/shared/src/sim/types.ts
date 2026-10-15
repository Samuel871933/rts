import type { AbilityKind } from '../data/champions';
import type { CampDef } from '../data/map';
import type { MinionType } from '../data/minions';
import type { StructureTier } from '../data/structures';
import type { Vec2 } from '../math';
import type { Lane, Role, Side, Team } from '../types';

export type UnitKind = 'champion' | 'minion' | 'turret' | 'inhibitor' | 'nexus' | 'monster' | 'ward';
export type DamageType = 'physical' | 'magic' | 'true';

export interface UnitBase {
  id: number;
  kind: UnitKind;
  team: Side;
  pos: Vec2;
  /** Position at the previous tick, used by the renderer to interpolate. */
  prevPos: Vec2;
  radius: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  armor: number;
  mr: number;
  ad: number;
  attackSpeed: number;
  range: number;
  attackTimer: number;
  moveSpeed: number;
  sight: number;
  targetId: number | null;
  path: Vec2[];
  pathGoal: Vec2 | null;
  visible: Record<Team, boolean>;
  lastDamagedAt: number;
  lastDamagedBy: number | null;
}

export type JungleScope = 'own' | 'enemy' | 'all';

export type Order =
  | { type: 'idle' }
  | { type: 'move'; pos: Vec2 }
  | { type: 'attackMove'; pos: Vec2 }
  | { type: 'attack'; targetId: number }
  /** Go clear a jungle camp, seen or not: attack its monster if there is one, else move on. */
  | { type: 'camp'; campId: string }
  | { type: 'lane'; lane: Lane }
  | { type: 'jungle'; scope: JungleScope }
  | { type: 'ward'; pos: Vec2 }
  | { type: 'follow'; targetId: number }
  | { type: 'recall' };

export type OrderType = Order['type'];

/** How a champion plays on its own between orders. */
export interface ChampionBehavior {
  /** Recall automatically under 25% HP. */
  autoRetreat: boolean;
  /** After a recall or a respawn, go back to the usual job. */
  autoReturn: boolean;
  /**
   * ON: the champion farms its post on its own (and resumes it after idling).
   * OFF: it drops its farming job and only acts on orders.
   */
  autoFarm: boolean;
  /**
   * Leave an enemy turret's range when it would start shooting us (no allied minions left under it,
   * or it already targets us), instead of finishing a siege / attack order there.
   */
  autoTurretSafety: boolean;
}

export type Activity =
  | 'idle'
  | 'moving'
  | 'fighting'
  | 'farming'
  | 'pushing'
  | 'jungling'
  | 'sieging'
  | 'retreating'
  | 'recalling'
  | 'warding'
  | 'escorting'
  | 'waiting'
  | 'shopping'
  | 'dead';

export interface ChampionStatsTracker {
  kills: number;
  deaths: number;
  cs: number;
  monsters: number;
  damageDealt: number;
  wardsPlaced: number;
  structures: number;
}

export interface ChampionUnit extends UnitBase {
  kind: 'champion';
  team: Team;
  defId: string;
  role: Role;
  level: number;
  xp: number;
  gold: number;
  totalGold: number;
  items: string[];
  baseAd: number;
  ap: number;
  abilityHaste: number;
  hpRegen: number;
  order: Order;
  /** Lane / jungle job resumed after temporary orders (attack, ward, recall, respawn). */
  standingOrder: Order | null;
  /** Player-tunable behaviour (see ChampionBehavior). */
  autoRetreat: boolean;
  autoReturn: boolean;
  autoFarm: boolean;
  autoTurretSafety: boolean;
  /** Usual job (last lane / jungle order, or the role's): what autoReturn / autoFarm go back to. */
  homeOrder: Order;
  /** Game time since which the champion has been idle without orders (autoFarm). */
  idleSince: number | null;
  /** Auto retreat already fired during this low-HP spell: later player orders are not overridden. */
  retreatFired: boolean;
  activity: Activity;
  recallTimer: number | null;
  respawnTimer: number;
  abilityCd: number;
  smiteCharges: number;
  /** Time until the next Smite charge. */
  smiteRecharge: number;
  /** Time before Smite can be cast again (15s between casts). */
  smiteLockout: number;
  wardCharges: number;
  wardRecharge: number;
  shield: number;
  shieldUntil: number;
  buffs: { blue: number; red: number; baron: number };
  hasBaron: boolean;
  /** Last time this champion damaged an enemy champion (turret aggro rule). */
  aggressionAt: number;
  turretRamp: { stacks: number; lastHit: number };
  stats: ChampionStatsTracker;
}

export interface MinionUnit extends UnitBase {
  kind: 'minion';
  team: Team;
  minionType: MinionType;
  lane: Lane;
  waypoint: number;
  retargetAt: number;
  /** Lane spot it left to fight: it never chases farther than MINION_CHASE_RANGE from there. */
  chaseFrom: Vec2 | null;
  /** Gold bounty (siege / super minions gain gold with upgrades). */
  bounty: number;
}

export interface StructureUnit extends UnitBase {
  kind: 'turret' | 'inhibitor' | 'nexus';
  team: Team;
  structureId: string;
  tier: StructureTier;
  lane: Lane | null;
  protectedBy: number[];
  protectMode: 'all' | 'any';
  respawnTimer: number;
  adMin: number;
  adMax: number;
  globalGold: number;
}

export interface MonsterUnit extends UnitBase {
  kind: 'monster';
  team: 'neutral';
  campId: string;
  home: Vec2;
  /** How far from its camp the monster may step (0 = never moves, like Baron). */
  leash: number;
  resetting: boolean;
  /** Since when it has been unable to hit its target (gives up after RULES.monsterPatience). */
  blockedSince: number | null;
  passive: boolean;
  epic: boolean;
}

export interface WardUnit extends UnitBase {
  kind: 'ward';
  team: Team;
  ownerId: number;
  expiresAt: number;
}

export type Unit = ChampionUnit | MinionUnit | StructureUnit | MonsterUnit | WardUnit;

/**
 * What a team knows about a camp: alive, down with a known respawn time (it saw the kill),
 * or found empty without knowing when it died.
 */
export interface CampIntel {
  status: 'up' | 'down' | 'unknown';
  respawnAt: number | null;
}

export interface CampState {
  def: CampDef;
  unitId: number | null;
  nextSpawnAt: number | null;
  intel: Record<Team, CampIntel>;
}

export interface TeamState {
  kills: number;
  structuresDestroyed: number;
  dragons: number;
  barons: number;
  gold: number;
}

export interface PendingSpawn {
  at: number;
  team: Team;
  lane: Lane;
  type: 'melee' | 'caster' | 'siege' | 'super';
}

export interface GameState {
  time: number;
  tick: number;
  units: Map<number, Unit>;
  champions: ChampionUnit[];
  structures: StructureUnit[];
  camps: CampState[];
  teams: Record<Team, TeamState>;
  wave: { number: number; nextAt: number; queue: PendingSpawn[] };
  winner: Team | null;
  firstBlood: boolean;
}

export type GameEvent =
  | { type: 'attack'; from: number; to: number; ranged: boolean }
  | { type: 'ability'; from: number; to: number | null; pos: Vec2; radius: number; kind: AbilityKind }
  | { type: 'death'; unitId: number; kind: UnitKind; team: Side; pos: Vec2 }
  | { type: 'championDied'; championId: number; killerId: number | null; respawnIn: number }
  | { type: 'championRespawned'; championId: number }
  | { type: 'levelUp'; championId: number; level: number }
  | { type: 'itemBought'; championId: number; itemId: string }
  | { type: 'structureDestroyed'; structureId: string; kind: UnitKind; team: Team; lane: Lane | null; tier: StructureTier }
  | { type: 'inhibitorRespawned'; structureId: string; team: Team }
  | { type: 'campSpawned'; campId: string; epic: boolean }
  | { type: 'campCleared'; campId: string; championId: number | null; team: Team | null; epic: boolean }
  | { type: 'buffGained'; championId: number; buff: 'blue' | 'red' | 'baron' }
  | { type: 'recallStarted' | 'recallCompleted' | 'recallCancelled' | 'autoRetreat' | 'turretRetreat'; championId: number }
  | { type: 'wardPlaced'; championId: number; pos: Vec2 }
  | { type: 'smite'; championId: number; targetId: number }
  | { type: 'orderFailed'; championId: number; reason: 'noWardCharge' | 'notTargetable' | 'dead' | 'campEmpty' }
  | { type: 'victory'; winner: Team };

export type GameEventRecord = GameEvent & { time: number };
