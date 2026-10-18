import { pointAtFraction } from '../math';
import type { Vec2 } from '../math';
import type { Lane, Team } from '../types';
import { LANE_PATHS } from './map';
import { NEXUS_POS, NEXUS_TURRET_POS } from './mapGeometry';

export type StructureKind = 'turret' | 'inhibitor' | 'nexus';
export type StructureTier = 'outer' | 'inner' | 'inhib' | 'nexus';

export interface StructureDef {
  id: string;
  kind: StructureKind;
  team: Team;
  lane: Lane | null;
  tier: StructureTier;
  pos: Vec2;
  /** The structure can't be damaged until these are destroyed ('all' or 'any' of them). */
  protectedBy: string[];
  protectMode: 'all' | 'any';
}

export interface StructureStats {
  hp: number;
  armor: number;
  mr: number;
  /** Attack damage ramps linearly from adMin (0:00) to adMax (30:00). */
  adMin: number;
  adMax: number;
  attackSpeed: number;
  radius: number;
  /** Gold given to every member of the destroying team. */
  globalGold: number;
}

/** LoL wiki turret page (current patch values), kept as the gameplay baseline. */
export const TURRET_STATS: Record<StructureTier, StructureStats> = {
  outer: { hp: 9000, armor: 60, mr: 60, adMin: 182, adMax: 350, attackSpeed: 0.833, radius: 90, globalGold: 50 },
  inner: { hp: 5000, armor: 60, mr: 60, adMin: 187, adMax: 427, attackSpeed: 0.833, radius: 90, globalGold: 25 },
  inhib: { hp: 4750, armor: 60, mr: 60, adMin: 187, adMax: 427, attackSpeed: 0.833, radius: 90, globalGold: 25 },
  nexus: { hp: 3500, armor: 60, mr: 60, adMin: 165, adMax: 405, attackSpeed: 0.833, radius: 90, globalGold: 50 },
};

export const INHIBITOR_STATS = { hp: 4000, armor: 20, mr: 0, radius: 160, globalGold: 50 };
export const NEXUS_STATS = { hp: 5500, armor: 0, mr: 0, radius: 240 };

/**
 * Turret/inhibitor positions are placed along `LANE_PATHS` by arc-length fraction from each team's
 * own nexus (0) toward the enemy nexus (1), instead of hand-copied Summoner's Rift coordinates: any
 * change to the lane shape in `mapGeometry.ts` keeps the structures on the lane automatically.
 */
const FRACTION_FROM_OWN_NEXUS = { outer: 0.3, inner: 0.14, inhibTurret: 0.065, inhibitor: 0.05 };

function laneStructurePos(team: Team, lane: Lane, tier: keyof typeof FRACTION_FROM_OWN_NEXUS): Vec2 {
  const t = FRACTION_FROM_OWN_NEXUS[tier];
  return pointAtFraction(LANE_PATHS[lane], team === 'blue' ? t : 1 - t);
}

function buildTeamStructures(team: Team): StructureDef[] {
  const id = (lane: Lane, tier: string) => `${team}_${lane}_${tier}`;
  const defs: StructureDef[] = [];
  const lanes: Lane[] = ['top', 'mid', 'bot'];

  for (const lane of lanes) {
    defs.push(
      { id: id(lane, 'outer'), kind: 'turret', team, lane, tier: 'outer', pos: laneStructurePos(team, lane, 'outer'), protectedBy: [], protectMode: 'all' },
      { id: id(lane, 'inner'), kind: 'turret', team, lane, tier: 'inner', pos: laneStructurePos(team, lane, 'inner'), protectedBy: [id(lane, 'outer')], protectMode: 'all' },
      { id: id(lane, 'inhib_turret'), kind: 'turret', team, lane, tier: 'inhib', pos: laneStructurePos(team, lane, 'inhibTurret'), protectedBy: [id(lane, 'inner')], protectMode: 'all' },
      { id: id(lane, 'inhibitor'), kind: 'inhibitor', team, lane, tier: 'inhib', pos: laneStructurePos(team, lane, 'inhibitor'), protectedBy: [id(lane, 'inhib_turret')], protectMode: 'all' },
    );
  }

  const inhibitors = lanes.map((lane) => id(lane, 'inhibitor'));
  const nexusTurrets = NEXUS_TURRET_POS[team].map((pos, i) => ({
    id: `${team}_nexus_turret_${i + 1}`,
    kind: 'turret' as const,
    team,
    lane: null,
    tier: 'nexus' as const,
    pos,
    protectedBy: inhibitors,
    protectMode: 'any' as const,
  }));
  defs.push(...nexusTurrets, {
    id: `${team}_nexus`,
    kind: 'nexus',
    team,
    lane: null,
    tier: 'nexus',
    pos: NEXUS_POS[team],
    protectedBy: nexusTurrets.map((t) => t.id),
    protectMode: 'all',
  });
  return defs;
}

export const STRUCTURES: StructureDef[] = [...buildTeamStructures('blue'), ...buildTeamStructures('red')];
