import type { Vec2 } from '../math';
import type { Lane, Team } from '../types';

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

/** LoL wiki turret page (current patch values). */
export const TURRET_STATS: Record<StructureTier, StructureStats> = {
  outer: { hp: 9000, armor: 60, mr: 60, adMin: 182, adMax: 350, attackSpeed: 0.833, radius: 90, globalGold: 50 },
  inner: { hp: 5000, armor: 60, mr: 60, adMin: 187, adMax: 427, attackSpeed: 0.833, radius: 90, globalGold: 25 },
  inhib: { hp: 4750, armor: 60, mr: 60, adMin: 187, adMax: 427, attackSpeed: 0.833, radius: 90, globalGold: 25 },
  nexus: { hp: 3500, armor: 60, mr: 60, adMin: 165, adMax: 405, attackSpeed: 0.833, radius: 90, globalGold: 50 },
};

export const INHIBITOR_STATS = { hp: 4000, armor: 20, mr: 0, radius: 160, globalGold: 50 };
export const NEXUS_STATS = { hp: 5500, armor: 0, mr: 0, radius: 240 };

const v = (x: number, y: number): Vec2 => ({ x, y });

interface LaneLayout {
  outer: Vec2;
  inner: Vec2;
  inhibTurret: Vec2;
  inhibitor: Vec2;
}

const LAYOUT: Record<Team, { lanes: Record<Lane, LaneLayout>; nexusTurrets: [Vec2, Vec2]; nexus: Vec2 }> = {
  blue: {
    lanes: {
      top: { outer: v(981, 10441), inner: v(1512, 6699), inhibTurret: v(1169, 4287), inhibitor: v(1171, 3571) },
      mid: { outer: v(5846, 6396), inner: v(5048, 4812), inhibTurret: v(3651, 3696), inhibitor: v(3203, 3208) },
      bot: { outer: v(10504, 1029), inner: v(6919, 1483), inhibTurret: v(4281, 1253), inhibitor: v(3452, 1236) },
    },
    nexusTurrets: [v(1748, 2270), v(2177, 1807)],
    nexus: v(1551, 1659),
  },
  red: {
    lanes: {
      top: { outer: v(4318, 13875), inner: v(7943, 13411), inhibTurret: v(10481, 13650), inhibitor: v(11261, 13676) },
      mid: { outer: v(8955, 8510), inner: v(9767, 10113), inhibTurret: v(11134, 11207), inhibitor: v(11598, 11667) },
      bot: { outer: v(13866, 4505), inner: v(13327, 8226), inhibTurret: v(13624, 10572), inhibitor: v(13604, 11316) },
    },
    nexusTurrets: [v(12611, 13084), v(13052, 12612)],
    nexus: v(13250, 13150),
  },
};

function buildTeamStructures(team: Team): StructureDef[] {
  const layout = LAYOUT[team];
  const id = (lane: Lane, tier: string) => `${team}_${lane}_${tier}`;
  const defs: StructureDef[] = [];
  const lanes: Lane[] = ['top', 'mid', 'bot'];

  for (const lane of lanes) {
    const l = layout.lanes[lane];
    defs.push(
      { id: id(lane, 'outer'), kind: 'turret', team, lane, tier: 'outer', pos: l.outer, protectedBy: [], protectMode: 'all' },
      { id: id(lane, 'inner'), kind: 'turret', team, lane, tier: 'inner', pos: l.inner, protectedBy: [id(lane, 'outer')], protectMode: 'all' },
      { id: id(lane, 'inhib_turret'), kind: 'turret', team, lane, tier: 'inhib', pos: l.inhibTurret, protectedBy: [id(lane, 'inner')], protectMode: 'all' },
      { id: id(lane, 'inhibitor'), kind: 'inhibitor', team, lane, tier: 'inhib', pos: l.inhibitor, protectedBy: [id(lane, 'inhib_turret')], protectMode: 'all' },
    );
  }

  const inhibitors = lanes.map((lane) => id(lane, 'inhibitor'));
  const nexusTurrets = layout.nexusTurrets.map((pos, i) => ({
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
    pos: layout.nexus,
    protectedBy: nexusTurrets.map((t) => t.id),
    protectMode: 'all',
  });
  return defs;
}

export const STRUCTURES: StructureDef[] = [...buildTeamStructures('blue'), ...buildTeamStructures('red')];
