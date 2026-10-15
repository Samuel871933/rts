import { CHAMPIONS_BY_ID } from '../data/champions';
import type { CampDef } from '../data/map';
import { MINION_STATS, WAVE_RULES, minionMoveSpeed, type MinionType } from '../data/minions';
import { MONSTER_STATS } from '../data/monsters';
import { RULES, wardDuration } from '../data/rules';
import { INHIBITOR_STATS, NEXUS_STATS, TURRET_STATS, type StructureDef } from '../data/structures';
import type { Vec2 } from '../math';
import type { ChampionPick, Lane, Side, Team } from '../types';
import type {
  ChampionUnit,
  MinionUnit,
  MonsterUnit,
  StructureUnit,
  UnitBase,
  UnitKind,
  WardUnit,
} from './types';

function baseUnit(id: number, kind: UnitKind, team: Side, pos: Vec2, radius: number): UnitBase {
  return {
    id,
    kind,
    team,
    pos: { ...pos },
    prevPos: { ...pos },
    radius,
    alive: true,
    hp: 1,
    maxHp: 1,
    armor: 0,
    mr: 0,
    ad: 0,
    attackSpeed: 0,
    range: 0,
    attackTimer: 0,
    moveSpeed: 0,
    sight: 0,
    targetId: null,
    path: [],
    pathGoal: null,
    visible: { blue: team === 'blue', red: team === 'red' },
    lastDamagedAt: -Infinity,
    lastDamagedBy: null,
  };
}

/** Stats are filled by recomputeChampionStats right after creation. */
export function createChampion(id: number, pick: ChampionPick, team: Team, pos: Vec2): ChampionUnit {
  if (!CHAMPIONS_BY_ID[pick.championId]) throw new Error(`Unknown champion ${pick.championId}`);
  return {
    ...baseUnit(id, 'champion', team, pos, 65),
    kind: 'champion',
    team,
    defId: pick.championId,
    role: pick.role,
    sight: RULES.championSight,
    level: 1,
    xp: 0,
    gold: RULES.startGold,
    totalGold: RULES.startGold,
    items: [],
    baseAd: 0,
    ap: 0,
    abilityHaste: 0,
    hpRegen: 0,
    order: { type: 'idle' },
    standingOrder: null,
    autoRetreat: true,
    autoReturn: true,
    autoFarm: true,
    homeOrder: { type: 'idle' },
    idleSince: null,
    activity: 'idle',
    recallTimer: null,
    respawnTimer: 0,
    abilityCd: 0,
    smiteCharges: 1,
    smiteRecharge: RULES.smiteFirstRecharge,
    smiteLockout: 0,
    wardCharges: RULES.wardMaxCharges,
    wardRecharge: 0,
    shield: 0,
    shieldUntil: 0,
    buffs: { blue: 0, red: 0, baron: 0 },
    hasBaron: false,
    aggressionAt: -Infinity,
    turretRamp: { stacks: 0, lastHit: -Infinity },
    stats: { kills: 0, deaths: 0, cs: 0, monsters: 0, damageDealt: 0, wardsPlaced: 0, structures: 0 },
  };
}

export function createMinion(id: number, team: Team, lane: Lane, type: MinionType, pos: Vec2, time: number): MinionUnit {
  const s = MINION_STATS[type];
  const upgrades = Math.max(0, Math.floor((time - WAVE_RULES.firstWaveAt) / WAVE_RULES.upgradeInterval));
  const hp = s.hp + s.hpPerUpgrade * upgrades;
  return {
    ...baseUnit(id, 'minion', team, pos, s.radius),
    kind: 'minion',
    team,
    minionType: type,
    lane,
    waypoint: 1,
    retargetAt: 0,
    bounty: s.gold + s.goldPerUpgrade * upgrades,
    hp,
    maxHp: hp,
    ad: s.ad + s.adPerUpgrade * upgrades,
    armor: s.armor,
    mr: s.mr,
    attackSpeed: s.attackSpeed,
    range: s.range,
    moveSpeed: minionMoveSpeed(time),
    sight: WAVE_RULES.sightRange,
  };
}

export function createStructure(id: number, def: StructureDef): StructureUnit {
  const base = {
    kind: def.kind,
    team: def.team,
    structureId: def.id,
    tier: def.tier,
    lane: def.lane,
    protectedBy: [] as number[],
    protectMode: def.protectMode,
    respawnTimer: 0,
    adMin: 0,
    adMax: 0,
    globalGold: 0,
  };
  if (def.kind === 'turret') {
    const s = TURRET_STATS[def.tier];
    return {
      ...baseUnit(id, def.kind, def.team, def.pos, s.radius),
      ...base,
      hp: s.hp,
      maxHp: s.hp,
      armor: s.armor,
      mr: s.mr,
      ad: s.adMin,
      adMin: s.adMin,
      adMax: s.adMax,
      attackSpeed: s.attackSpeed,
      range: RULES.turretRange,
      sight: RULES.turretSight,
      globalGold: s.globalGold,
    };
  }
  const s = def.kind === 'inhibitor' ? INHIBITOR_STATS : { ...NEXUS_STATS, globalGold: 0 };
  return {
    ...baseUnit(id, def.kind, def.team, def.pos, s.radius),
    ...base,
    hp: s.hp,
    maxHp: s.hp,
    armor: s.armor,
    mr: s.mr,
    sight: RULES.baseStructureSight,
    globalGold: s.globalGold,
  };
}

export function createMonster(id: number, camp: CampDef): MonsterUnit {
  const s = MONSTER_STATS[camp.kind];
  return {
    ...baseUnit(id, 'monster', 'neutral', camp.pos, s.radius),
    kind: 'monster',
    team: 'neutral',
    campId: camp.id,
    home: { ...camp.pos },
    leash: s.leash,
    resetting: false,
    passive: s.passive,
    epic: s.epic,
    hp: s.hp,
    maxHp: s.hp,
    ad: s.ad,
    armor: s.armor,
    mr: s.mr,
    attackSpeed: s.attackSpeed,
    range: s.range,
    moveSpeed: 350,
    visible: { blue: false, red: false },
  };
}

export function createWard(id: number, owner: ChampionUnit, pos: Vec2, time: number): WardUnit {
  return {
    ...baseUnit(id, 'ward', owner.team, pos, 30),
    kind: 'ward',
    team: owner.team,
    ownerId: owner.id,
    expiresAt: time + wardDuration(owner.level),
    sight: RULES.wardSight,
  };
}
