import type { Vec2 } from '../math';
import { TERRAIN_RES, TERRAIN_RLE } from './terrain.generated';

/** Summoner's Rift terrain, traced from the official minimap (see scripts/build-terrain.py). */
export const TERRAIN = {
  wall: 0,
  ground: 1,
  river: 2,
  base: 3,
} as const;
export type TerrainKind = (typeof TERRAIN)[keyof typeof TERRAIN];

export { TERRAIN_RES };
/** World size the minimap spans (Summoner's Rift is slightly larger than MAP_SIZE). */
const TERRAIN_WORLD_SIZE = 14870;
/** World units covered by one terrain cell. */
export const TERRAIN_CELL = TERRAIN_WORLD_SIZE / TERRAIN_RES;

const CODES: Record<string, TerrainKind> = { '#': TERRAIN.wall, '.': TERRAIN.ground, '~': TERRAIN.river, b: TERRAIN.base };

let grid: Uint8Array | null = null;

/** Terrain cells, row-major, row 0 = bottom of the map (world y = 0). Decoded once. */
export function terrainGrid(): Readonly<Uint8Array> {
  if (grid) return grid;
  grid = new Uint8Array(TERRAIN_RES * TERRAIN_RES);
  let i = 0;
  for (const [, count, code] of TERRAIN_RLE.matchAll(/(\d+)(.)/g)) {
    grid.fill(CODES[code], i, i + Number(count));
    i += Number(count);
  }
  return grid;
}

export function terrainAt(p: Vec2): TerrainKind {
  const x = Math.floor(p.x / TERRAIN_CELL);
  const y = Math.floor(p.y / TERRAIN_CELL);
  if (x < 0 || y < 0 || x >= TERRAIN_RES || y >= TERRAIN_RES) return TERRAIN.wall;
  return terrainGrid()[y * TERRAIN_RES + x] as TerrainKind;
}

export const isTerrainWalkable = (p: Vec2) => terrainAt(p) !== TERRAIN.wall;
