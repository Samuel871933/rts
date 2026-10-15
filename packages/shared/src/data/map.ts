import { MAP_SIZE } from '../constants';
import type { Vec2 } from '../math';
import type { Lane, Team } from '../types';
import { STRUCTURES } from './structures';

/**
 * Summoner's Rift layout in LoL units (blue base bottom-left, y up). Walls / paths come from the
 * terrain grid (data/terrain.ts); this file holds the gameplay spots: fountains, lanes and camps.
 */

const v = (x: number, y: number): Vec2 => ({ x, y });
/** Reflection across the y = x diagonal: maps the top-side of a base to its bot-side. */
export const mirrorDiagonal = (p: Vec2): Vec2 => v(p.y, p.x);
/** Point reflection around the map center: maps blue side to red side. */
export const mirrorCenter = (p: Vec2): Vec2 => v(MAP_SIZE - p.x, MAP_SIZE - p.y);

export const FOUNTAINS: Record<Team, Vec2> = {
  blue: v(550, 550),
  red: mirrorCenter(v(550, 550)),
};

/** Lane centerlines, always written from blue base to red base. */
const TOP_LANE: Vec2[] = [
  v(1250, 2600), v(1170, 4300), v(1250, 6700), v(1000, 10400), v(1250, 12100),
  v(2050, 12820), v(2900, 13550), v(4300, 13850), v(7900, 13500), v(10500, 13650), v(11300, 13650), v(12300, 13550),
];

const MID_LANE: Vec2[] = [
  v(2300, 2300), v(3200, 3200), v(3650, 3700), v(5050, 4850), v(5850, 6350), v(7400, 7400),
  v(8950, 8450), v(9750, 10000), v(11150, 11200), v(11600, 11650), v(12500, 12500),
];

const nexusOf = (team: Team): Vec2 => STRUCTURES.find((s) => s.kind === 'nexus' && s.team === team)!.pos;

/**
 * Each lane runs nexus to nexus, like on the Rift: waves come out of their nexus and, once the
 * inhibitor is down, keep pushing past the nexus turrets to the enemy nexus.
 */
const nexusToNexus = (lane: Vec2[]): Vec2[] => [nexusOf('blue'), ...lane, nexusOf('red')];

export const LANE_PATHS: Record<Lane, Vec2[]> = {
  top: nexusToNexus(TOP_LANE),
  mid: nexusToNexus(MID_LANE),
  bot: nexusToNexus(TOP_LANE.map(mirrorDiagonal)),
};

export const LANE_WIDTH = 900;

export type CampKind =
  | 'blueSentinel'
  | 'redBrambleback'
  | 'gromp'
  | 'krugs'
  | 'wolves'
  | 'raptors'
  | 'scuttle'
  | 'dragon'
  | 'baron';

export interface CampDef {
  id: string;
  kind: CampKind;
  /** Team whose jungle the camp belongs to; neutral for river objectives. */
  owner: Team | 'neutral';
  pos: Vec2;
}

/**
 * Camp spots: real Summoner's Rift positions (LoL units), placed like on the Rift at the back of
 * their walled alcove, on the axis of its opening (~230 units from the back wall).
 */
const camp = (owner: CampDef['owner'], kind: CampKind, x: number, y: number): CampDef => ({
  id: owner === 'neutral' ? kind : `${owner}_${kind}`,
  kind,
  owner,
  pos: v(x, y),
});

export const CAMPS: CampDef[] = [
  camp('blue', 'blueSentinel', 3890, 8037),
  camp('blue', 'gromp', 2145, 8429),
  camp('blue', 'wolves', 3777, 6316),
  camp('blue', 'raptors', 7038, 5396),
  camp('blue', 'redBrambleback', 7922, 4033),
  camp('blue', 'krugs', 8470, 2651),
  camp('red', 'blueSentinel', 11051, 6937),
  camp('red', 'gromp', 12783, 6488),
  camp('red', 'wolves', 11233, 8644),
  camp('red', 'raptors', 7879, 9494),
  camp('red', 'redBrambleback', 7173, 10872),
  camp('red', 'krugs', 6487, 12248),
  { ...camp('neutral', 'scuttle', 4400, 9600), id: 'scuttle_top' },
  { ...camp('neutral', 'scuttle', 10500, 5160), id: 'scuttle_bot' },
  camp('neutral', 'dragon', 9818, 4223),
  camp('neutral', 'baron', 5139, 10705),
];
