import { MAP_SIZE } from '../constants';
import type { Vec2 } from '../math';
import type { Lane, Team } from '../types';

/**
 * Original MacroGod map ("the Spire"): same gameplay skeleton as a classic 3-lane MOBA (2 bases on
 * opposite corners, top/mid/bot lanes, symmetric jungle, a river with epic pits), but its own angular,
 * retro-futuristic layout instead of a trace of Summoner's Rift. This file is the single source of
 * truth for the map's shape: `map.ts` and `structures.ts` build the gameplay data from it, and
 * `scripts/build-terrain.ts` rasterizes it into the terrain grid (see also the Blender block-out
 * script under `scripts/blender/`).
 */

const v = (x: number, y: number): Vec2 => ({ x, y });
/** Reflection across the y = x diagonal: maps the top side of a base to its bot side. */
export const mirrorDiagonal = (p: Vec2): Vec2 => v(p.y, p.x);
/** Point reflection around the map center: maps blue side to red side. */
export const mirrorCenter = (p: Vec2): Vec2 => v(MAP_SIZE - p.x, MAP_SIZE - p.y);

// --- Bases -------------------------------------------------------------------------------------

/** Chamfered-square platform in the corner: reads as an industrial pad, not a round LoL fountain. */
const BLUE_BASE_POLYGON: Vec2[] = [v(0, 0), v(3100, 0), v(3100, 2250), v(2250, 3100), v(0, 3100)];
export const BASE_POLYGONS: Record<Team, Vec2[]> = {
  blue: BLUE_BASE_POLYGON,
  red: BLUE_BASE_POLYGON.map(mirrorCenter),
};

export const NEXUS_POS: Record<Team, Vec2> = { blue: v(1500, 1500), red: mirrorCenter(v(1500, 1500)) };
export const FOUNTAIN_POS: Record<Team, Vec2> = { blue: v(850, 850), red: mirrorCenter(v(850, 850)) };

// --- Lanes ---------------------------------------------------------------------------------------
// Catwalk-like centerlines, nexus to nexus (nexus points added by map.ts), angular instead of organic.

const TOP_LANE: Vec2[] = [
  v(1500, 3600),
  v(1350, 7400),
  v(1500, 11200),
  v(2800, 13000),
  v(5200, 13700),
  v(9600, 13700),
  v(12000, 13000),
];
const BOT_LANE: Vec2[] = TOP_LANE.map(mirrorDiagonal);

const MID_HALF: Vec2[] = [v(2800, 3200), v(2800, 5200), v(4800, 5200), v(4800, 7000), v(6600, 7000)];
const MID_CENTER = v(7400, 7400);
const MID_LANE: Vec2[] = [...MID_HALF, MID_CENTER, ...MID_HALF.slice().reverse().map(mirrorCenter)];

export const LANE_CENTERLINES: Record<Lane, Vec2[]> = { top: TOP_LANE, mid: MID_LANE, bot: BOT_LANE };
export const LANE_WIDTH = 900;

/** A point `distance` out from `from`, in the direction of `to`: used to plant a nexus turret right on a lane's approach, whatever that lane's shape. */
function alongDirection(from: Vec2, to: Vec2, distance: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return v(from.x + (dx / len) * distance, from.y + (dy / len) * distance);
}

const NEXUS_TURRET_DISTANCE = 550;
/** Index 0 guards the top-lane approach, index 1 the bot-lane approach. */
export const NEXUS_TURRET_POS: Record<Team, Vec2[]> = {
  blue: [
    alongDirection(NEXUS_POS.blue, TOP_LANE[0], NEXUS_TURRET_DISTANCE),
    alongDirection(NEXUS_POS.blue, BOT_LANE[0], NEXUS_TURRET_DISTANCE),
  ],
  red: [
    alongDirection(NEXUS_POS.red, TOP_LANE[TOP_LANE.length - 1], NEXUS_TURRET_DISTANCE),
    alongDirection(NEXUS_POS.red, BOT_LANE[BOT_LANE.length - 1], NEXUS_TURRET_DISTANCE),
  ],
};

// --- River -----------------------------------------------------------------------------------
// Anti-diagonal canal crossing mid lane near the map center; bulges at both ends become the epic pits.

export const RIVER_PATH: Vec2[] = [
  v(2080, 11920),
  v(3200, 10800),
  v(4800, 9200),
  v(6000, 8000),
  MID_CENTER,
  v(8800, 6800),
  v(10000, 5600),
  v(11600, 4000),
  v(12720, 2880),
];
export const RIVER_WIDTH = 760;
export const RIVER_PIT_RADIUS = 760;
export const BARON_POS = RIVER_PATH[0];
export const DRAGON_POS = RIVER_PATH[RIVER_PATH.length - 1];
/** Scuttle crossings: mid-segment points on the river, away from the sharp bends. */
export const SCUTTLE_TOP_POS = v(3900, 10100);
export const SCUTTLE_BOT_POS = v(10900, 4700);

/**
 * Maintenance tunnel: a narrower, fully enclosed shortcut between the two jungles. Deliberately offset
 * from the river's line (not just its width) so the two never overlap — a roofed corridor floating
 * over open river water would look like a stray rectangle.
 */
export const TUNNEL_PATH: Vec2[] = [v(4800, 5200), v(8700, 8700), v(10000, 9600)];
export const TUNNEL_WIDTH = 560;

// --- Jungle camps ------------------------------------------------------------------------------

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

export const CAMP_ALCOVE_RADIUS = 480;

/** Blue jungle alcoves; red's are the point-mirror with the same camp kinds. */
const BLUE_ALCOVES: { kind: CampKind; pos: Vec2; backbone: Lane }[] = [
  { kind: 'blueSentinel', pos: v(4600, 9000), backbone: 'mid' },
  { kind: 'gromp', pos: v(2500, 9600), backbone: 'top' },
  { kind: 'wolves', pos: v(4000, 6500), backbone: 'mid' },
  { kind: 'raptors', pos: v(7600, 5200), backbone: 'mid' },
  { kind: 'redBrambleback', pos: v(8600, 3600), backbone: 'bot' },
  { kind: 'krugs', pos: v(10400, 3200), backbone: 'bot' },
];

/**
 * Extra camp-to-camp jungle paths, on top of each camp's own lane connector: more circulation through
 * the jungle itself, not just lane <-> camp. Chains the whole blue jungle into one loop (mirrored for
 * red), so a jungler can walk camp to camp without detouring through a lane.
 */
const BLUE_JUNGLE_LINKS: [CampKind, CampKind][] = [
  ['gromp', 'wolves'],
  ['wolves', 'blueSentinel'],
  ['blueSentinel', 'raptors'],
  ['raptors', 'redBrambleback'],
  ['redBrambleback', 'krugs'],
];

/** Jungle alcove geometry for the terrain rasterizer: a disc, linked to a lane by a short corridor. */
export interface JungleAlcove {
  center: Vec2;
  radius: number;
  backbone: Lane;
}

function camp(owner: CampDef['owner'], kind: CampKind, pos: Vec2): CampDef {
  return { id: owner === 'neutral' ? kind : `${owner}_${kind}`, kind, owner, pos };
}

export const JUNGLE_ALCOVES: JungleAlcove[] = [
  ...BLUE_ALCOVES.map((a) => ({ center: a.pos, radius: CAMP_ALCOVE_RADIUS, backbone: a.backbone })),
  ...BLUE_ALCOVES.map((a) => ({ center: mirrorCenter(a.pos), radius: CAMP_ALCOVE_RADIUS, backbone: a.backbone })),
];

export const CAMPS: CampDef[] = [
  ...BLUE_ALCOVES.map((a) => camp('blue', a.kind, a.pos)),
  ...BLUE_ALCOVES.map((a) => camp('red', a.kind, mirrorCenter(a.pos))),
  { ...camp('neutral', 'scuttle', SCUTTLE_TOP_POS), id: 'scuttle_top' },
  { ...camp('neutral', 'scuttle', SCUTTLE_BOT_POS), id: 'scuttle_bot' },
  camp('neutral', 'baron', BARON_POS),
  camp('neutral', 'dragon', DRAGON_POS),
];

const campPos = (kind: CampKind): Vec2 => BLUE_ALCOVES.find((a) => a.kind === kind)!.pos;

/** Camp-to-camp jungle path segments, both jungles, for the terrain rasterizer and the Blender script. */
export const JUNGLE_LINKS: { a: Vec2; b: Vec2 }[] = [
  ...BLUE_JUNGLE_LINKS.map(([a, b]) => ({ a: campPos(a), b: campPos(b) })),
  ...BLUE_JUNGLE_LINKS.map(([a, b]) => ({ a: mirrorCenter(campPos(a)), b: mirrorCenter(campPos(b)) })),
];
export const JUNGLE_LINK_WIDTH = 420;
