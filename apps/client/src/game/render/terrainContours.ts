import { TERRAIN_CELL, TERRAIN_RES, terrainGrid, type TerrainKind, type Vec2 } from '@macrogod/shared';
import { toView } from './Camera';

/**
 * Smooth outlines of terrain regions (marching squares over a lightly blurred mask), in view space.
 * Loops can be nested (holes): fill them with the even-odd rule.
 */
export type Loop = Vec2[];

/** Segments of each marching-squares case, as pairs of square edges (0 bottom, 1 right, 2 top, 3 left). */
const CASES: Record<number, [number, number][]> = {
  1: [[3, 0]],
  2: [[0, 1]],
  3: [[3, 1]],
  4: [[1, 2]],
  6: [[0, 2]],
  7: [[3, 2]],
  8: [[2, 3]],
  9: [[0, 2]],
  11: [[1, 2]],
  12: [[3, 1]],
  13: [[0, 1]],
  14: [[3, 0]],
};
/** Saddles (5, 10) depend on the square's center value. */
const SADDLES: Record<number, { joined: [number, number][]; split: [number, number][] }> = {
  5: { joined: [[0, 1], [2, 3]], split: [[3, 0], [1, 2]] },
  10: { joined: [[3, 0], [1, 2]], split: [[0, 1], [2, 3]] },
};

const cache = new Map<string, Loop[]>();

/** Outlines of the cells whose terrain is one of `kinds` (cached per set of kinds). */
export function terrainLoops(kinds: readonly TerrainKind[]): Loop[] {
  const key = kinds.join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const loops = traceLoops(blurredMask(kinds));
  cache.set(key, loops);
  return loops;
}

/** Field on a (RES + 2)² vertex grid (zero border so every loop closes), 3x3 box blur. */
function blurredMask(kinds: readonly TerrainKind[]): Float32Array {
  const n = TERRAIN_RES;
  const grid = terrainGrid();
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < n && y < n && kinds.includes(grid[y * n + x] as TerrainKind) ? 1 : 0;
  const w = n + 2;
  const field = new Float32Array(w * w);
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= n; i++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += inside(i - 1 + dx, j - 1 + dy);
      field[j * w + i] = sum / 9;
    }
  }
  return field;
}

function traceLoops(field: Float32Array): Loop[] {
  const w = TERRAIN_RES + 2;
  const at = (i: number, j: number) => field[j * w + i];
  // Vertex (i, j) is the center of terrain cell (i - 1, j - 1).
  const world = (i: number, j: number): Vec2 => ({ x: (i - 0.5) * TERRAIN_CELL, y: (j - 0.5) * TERRAIN_CELL });
  const cross = (ai: number, aj: number, bi: number, bj: number): Vec2 => {
    const fa = at(ai, aj);
    const t = (0.5 - fa) / (at(bi, bj) - fa);
    const a = world(ai, aj);
    const b = world(bi, bj);
    return toView({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  };

  // Each crossing is identified by its grid edge: horizontal edges even ids, vertical ones odd.
  const points = new Map<number, Vec2>();
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };

  for (let j = 0; j < w - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const v0 = at(i, j) >= 0.5 ? 1 : 0;
      const v1 = at(i + 1, j) >= 0.5 ? 2 : 0;
      const v2 = at(i + 1, j + 1) >= 0.5 ? 4 : 0;
      const v3 = at(i, j + 1) >= 0.5 ? 8 : 0;
      const code = v0 | v1 | v2 | v3;
      if (code === 0 || code === 15) continue;
      const edgeId = [2 * (j * w + i), 2 * (j * w + i + 1) + 1, 2 * ((j + 1) * w + i), 2 * (j * w + i) + 1];
      const edgePoint = [
        () => cross(i, j, i + 1, j),
        () => cross(i + 1, j, i + 1, j + 1),
        () => cross(i, j + 1, i + 1, j + 1),
        () => cross(i, j, i, j + 1),
      ];
      const saddle = SADDLES[code];
      const center = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4;
      const segments = saddle ? (center >= 0.5 ? saddle.joined : saddle.split) : CASES[code];
      for (const [a, b] of segments) {
        if (!points.has(edgeId[a])) points.set(edgeId[a], edgePoint[a]());
        if (!points.has(edgeId[b])) points.set(edgeId[b], edgePoint[b]());
        link(edgeId[a], edgeId[b]);
      }
    }
  }

  // Every crossing has exactly two neighbours: walk them into closed loops.
  const loops: Loop[] = [];
  const visited = new Set<number>();
  for (const startId of links.keys()) {
    if (visited.has(startId)) continue;
    const loop: Loop = [];
    let prev = -1;
    let id = startId;
    while (!visited.has(id)) {
      visited.add(id);
      loop.push(points.get(id)!);
      const [a, b] = links.get(id)!;
      const next = a !== prev ? a : b;
      prev = id;
      id = next;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}
