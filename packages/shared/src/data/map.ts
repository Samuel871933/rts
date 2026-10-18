import type { Vec2 } from '../math';
import type { Lane } from '../types';
import {
  CAMPS,
  FOUNTAIN_POS,
  JUNGLE_LINKS,
  JUNGLE_LINK_WIDTH,
  LANE_CENTERLINES,
  LANE_WIDTH as GEOM_LANE_WIDTH,
  NEXUS_POS,
  TUNNEL_PATH,
  TUNNEL_WIDTH,
  mirrorCenter,
  mirrorDiagonal,
} from './mapGeometry';

export type { CampDef, CampKind } from './mapGeometry';
export { CAMPS, JUNGLE_LINKS, JUNGLE_LINK_WIDTH, TUNNEL_PATH, TUNNEL_WIDTH, mirrorCenter, mirrorDiagonal };

export const FOUNTAINS = FOUNTAIN_POS;

/**
 * Each lane runs nexus to nexus: waves come out of their nexus and, once the inhibitor is down,
 * keep pushing past the nexus turrets to the enemy nexus. The centerlines themselves live in
 * `mapGeometry.ts`, which is also what the terrain rasterizer (`scripts/build-terrain.ts`) reads.
 */
const nexusToNexus = (lane: Vec2[]): Vec2[] => [NEXUS_POS.blue, ...lane, NEXUS_POS.red];

export const LANE_PATHS: Record<Lane, Vec2[]> = {
  top: nexusToNexus(LANE_CENTERLINES.top),
  mid: nexusToNexus(LANE_CENTERLINES.mid),
  bot: nexusToNexus(LANE_CENTERLINES.bot),
};

export const LANE_WIDTH = GEOM_LANE_WIDTH;
