export interface Vec2 {
  x: number;
  y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Closest point of segment [a, b] to p, with its parameter t in [0, 1]. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0, 1);
  return { point: { x: a.x + abx * t, y: a.y + aby * t }, t };
}

export const distToSegment = (p: Vec2, a: Vec2, b: Vec2): number => dist(p, closestOnSegment(p, a, b).point);

/** Point at `distance` from `from` in the direction of `to` (never overshoots). */
export function stepTowards(from: Vec2, to: Vec2, distance: number): Vec2 {
  const d = dist(from, to);
  if (d <= distance || d === 0) return { x: to.x, y: to.y };
  const k = distance / d;
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
