export interface Vec2 {
  x: number;
  y: number;
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));

export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Closest point of segment [a, b] to p, with its parameter t in [0, 1]. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0, 1);
  return { point: { x: a.x + abx * t, y: a.y + aby * t }, t };
}

/** Closest point of a polyline to p, with the distance to it. */
export function closestOnPath(p: Vec2, path: readonly Vec2[]): { point: Vec2; distance: number } {
  let best = { point: path[0], distance: Infinity };
  for (let i = 0; i < path.length - 1; i++) {
    const { point } = closestOnSegment(p, path[i], path[i + 1]);
    const d = dist(p, point);
    if (d < best.distance) best = { point, distance: d };
  }
  return best;
}

/** Point at arc-length fraction `t` (0..1) along a polyline, from its first vertex. */
export function pointAtFraction(path: readonly Vec2[], t: number): Vec2 {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = dist(path[i], path[i + 1]);
    lengths.push(len);
    total += len;
  }
  let target = clamp(t, 0, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) return lerpVec(path[i], path[i + 1], lengths[i] === 0 ? 0 : clamp(target / lengths[i], 0, 1));
    target -= lengths[i];
  }
  return path[path.length - 1];
}
