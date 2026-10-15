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
