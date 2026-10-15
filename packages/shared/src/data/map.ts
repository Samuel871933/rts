import { MAP_SIZE } from '../constants';
import type { Vec2 } from '../math';
import type { Lane, Team } from '../types';

/**
 * Summoner's Rift layout. Everything walkable is described as shapes (thick polylines and circles);
 * whatever they don't cover is wall / forest. The renderer and the nav grid both read these shapes.
 * Coordinates are approximations of the real map (LoL units, blue base bottom-left).
 */

export interface CircleShape {
  center: Vec2;
  radius: number;
}

export interface PathShape {
  points: Vec2[];
  width: number;
}

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
  v(1250, 2600), v(1170, 4300), v(1250, 6700), v(1000, 10400), v(1300, 13100),
  v(2000, 13750), v(4300, 13850), v(7900, 13500), v(10500, 13650), v(11300, 13650), v(12300, 13550),
];

const MID_LANE: Vec2[] = [
  v(2300, 2300), v(3200, 3200), v(3650, 3700), v(5050, 4850), v(5850, 6350), v(7400, 7400),
  v(8950, 8450), v(9750, 10000), v(11150, 11200), v(11600, 11650), v(12500, 12500),
];

export const LANE_PATHS: Record<Lane, Vec2[]> = {
  top: TOP_LANE,
  mid: MID_LANE,
  bot: TOP_LANE.map(mirrorDiagonal),
};

export const LANE_WIDTH = 900;

export const BASES: Record<Team, CircleShape> = {
  blue: { center: v(600, 600), radius: 3900 },
  red: { center: mirrorCenter(v(600, 600)), radius: 3900 },
};

export const RIVER: PathShape = {
  width: 1200,
  points: [
    v(1700, 13100), v(3000, 11800), v(4300, 10200), v(5700, 8900), v(7400, 7400),
    v(9100, 5900), v(10500, 4600), v(11800, 3000), v(13100, 1700),
  ],
};

export const BARON_PIT: CircleShape = { center: v(5000, 10450), radius: 650 };
export const DRAGON_PIT: CircleShape = { center: mirrorCenter(BARON_PIT.center), radius: 650 };

/** Camp positions of the blue team's top-side jungle (blue buff side). Other quadrants are reflections. */
const QUADRANT_CAMPS = {
  buff: v(3800, 7900),
  big: v(2100, 8400),
  pack: v(3800, 6500),
};

/** Jungle corridors of the blue top-side quadrant. */
const QUADRANT_PATHS: Vec2[][] = [
  [v(1200, 5600), v(2600, 5700), QUADRANT_CAMPS.pack],
  [v(4200, 4150), v(3700, 5300), QUADRANT_CAMPS.pack],
  [QUADRANT_CAMPS.pack, QUADRANT_CAMPS.buff],
  [QUADRANT_CAMPS.buff, QUADRANT_CAMPS.big],
  [QUADRANT_CAMPS.big, v(1000, 8900)],
  [QUADRANT_CAMPS.big, v(2400, 10000), v(3000, 11800)],
  [QUADRANT_CAMPS.buff, v(4000, 9100), v(4300, 10200)],
  [QUADRANT_CAMPS.pack, v(5000, 6700), v(5900, 6000)],
  [QUADRANT_CAMPS.buff, v(5300, 8100), v(6400, 8300)],
];

const JUNGLE_WIDTH = 650;
const CLEARING_RADIUS = 480;

type Transform = (p: Vec2) => Vec2;
const QUADRANTS: Transform[] = [
  (p) => p,
  mirrorDiagonal,
  mirrorCenter,
  (p) => mirrorCenter(mirrorDiagonal(p)),
];

export const JUNGLE_PATHS: PathShape[] = QUADRANTS.flatMap((transform) =>
  QUADRANT_PATHS.map((points) => ({ points: points.map(transform), width: JUNGLE_WIDTH })),
);

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

function quadrantCamps(owner: Team, side: 'buffSide' | 'redSide', transform: Transform): CampDef[] {
  const names: Record<keyof typeof QUADRANT_CAMPS, CampKind> =
    side === 'buffSide'
      ? { buff: 'blueSentinel', big: 'gromp', pack: 'wolves' }
      : { buff: 'redBrambleback', big: 'krugs', pack: 'raptors' };
  return (Object.keys(QUADRANT_CAMPS) as (keyof typeof QUADRANT_CAMPS)[]).map((key) => ({
    id: `${owner}_${names[key]}`,
    kind: names[key],
    owner,
    pos: transform(QUADRANT_CAMPS[key]),
  }));
}

const SCUTTLE_TOP = v(4300, 10200);

export const CAMPS: CampDef[] = [
  ...quadrantCamps('blue', 'buffSide', QUADRANTS[0]),
  ...quadrantCamps('blue', 'redSide', QUADRANTS[1]),
  ...quadrantCamps('red', 'buffSide', QUADRANTS[2]),
  ...quadrantCamps('red', 'redSide', QUADRANTS[3]),
  { id: 'scuttle_top', kind: 'scuttle', owner: 'neutral', pos: SCUTTLE_TOP },
  { id: 'scuttle_bot', kind: 'scuttle', owner: 'neutral', pos: mirrorCenter(SCUTTLE_TOP) },
  { id: 'dragon', kind: 'dragon', owner: 'neutral', pos: DRAGON_PIT.center },
  { id: 'baron', kind: 'baron', owner: 'neutral', pos: BARON_PIT.center },
];

export const CLEARINGS: CircleShape[] = CAMPS.filter((c) => c.kind !== 'dragon' && c.kind !== 'baron').map(
  (c) => ({ center: c.pos, radius: CLEARING_RADIUS }),
);

export interface WalkableShapes {
  paths: PathShape[];
  circles: CircleShape[];
}

export const WALKABLE: WalkableShapes = {
  paths: [
    ...Object.values(LANE_PATHS).map((points) => ({ points, width: LANE_WIDTH })),
    RIVER,
    ...JUNGLE_PATHS,
  ],
  circles: [BASES.blue, BASES.red, BARON_PIT, DRAGON_PIT, ...CLEARINGS],
};
