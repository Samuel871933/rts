import { MAP_SIZE, NAV_CELL_SIZE } from '../../constants';
import { isTerrainWalkable } from '../../data/terrain';
import { dist, type Vec2 } from '../../math';
import { MinHeap } from './MinHeap';

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** Walkability grid built from the terrain, with A* pathfinding and line-of-sight smoothing. */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly walkable: Uint8Array;
  private readonly gScore: Float64Array;
  private readonly parent: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private generation = 0;
  private readonly heap = new MinHeap();

  constructor(
    readonly size: number,
    readonly cellSize: number,
    isWalkable: (p: Vec2) => boolean,
  ) {
    this.cols = Math.ceil(size / cellSize);
    this.rows = this.cols;
    const n = this.cols * this.rows;
    this.walkable = new Uint8Array(n);
    this.gScore = new Float64Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.rasterize(isWalkable);
  }

  /** A cell is walkable when most of it is (3x3 samples), so narrow wall tips don't block paths. */
  private rasterize(isWalkable: (p: Vec2) => boolean) {
    const step = this.cellSize / 3;
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        let open = 0;
        for (let sy = 0; sy < 3; sy++) {
          for (let sx = 0; sx < 3; sx++) {
            if (isWalkable({ x: cx * this.cellSize + (sx + 0.5) * step, y: cy * this.cellSize + (sy + 0.5) * step })) open++;
          }
        }
        if (open >= 5) this.walkable[cy * this.cols + cx] = 1;
      }
    }
  }

  cellCenter(cx: number, cy: number): Vec2 {
    return { x: (cx + 0.5) * this.cellSize, y: (cy + 0.5) * this.cellSize };
  }

  private cellIndex(p: Vec2): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(p.x / this.cellSize)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(p.y / this.cellSize)));
    return cy * this.cols + cx;
  }

  isWalkable(p: Vec2): boolean {
    if (p.x < 0 || p.y < 0 || p.x >= this.size || p.y >= this.size) return false;
    return this.walkable[this.cellIndex(p)] === 1;
  }

  /** Closest walkable point (spiral search over cells). */
  nearestWalkable(p: Vec2): Vec2 {
    if (this.isWalkable(p)) return p;
    const cx0 = Math.floor(p.x / this.cellSize);
    const cy0 = Math.floor(p.y / this.cellSize);
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (let r = 1; r < 40; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const cx = cx0 + dx;
          const cy = cy0 + dy;
          if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
          if (!this.walkable[cy * this.cols + cx]) continue;
          const c = this.cellCenter(cx, cy);
          const d = dist(c, p);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
      }
      if (best) return best;
    }
    return p;
  }

  hasLineOfSight(a: Vec2, b: Vec2): boolean {
    const d = dist(a, b);
    const steps = Math.ceil(d / (this.cellSize / 3));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }

  /** Smoothed path from `from` to `to` (excluding the start point). Empty if unreachable. */
  findPath(from: Vec2, to: Vec2): Vec2[] {
    const start = this.isWalkable(from) ? from : this.nearestWalkable(from);
    const goal = this.isWalkable(to) ? to : this.nearestWalkable(to);
    // Copies: a path must never alias the caller's objects (a unit's position, a shared constant).
    if (this.hasLineOfSight(start, goal)) return start === from ? [{ ...goal }] : [{ ...start }, { ...goal }];

    const cells = this.astar(this.cellIndex(start), this.cellIndex(goal));
    if (!cells) return [];
    const points = cells.map((i) => this.cellCenter(i % this.cols, Math.floor(i / this.cols)));
    points[points.length - 1] = { ...goal };
    return this.smooth(start, points);
  }

  private astar(startIdx: number, goalIdx: number): number[] | null {
    if (this.generation === 0xffffffff) {
      // Stamps are 32-bit: start over before they wrap (the grid is shared by every game).
      this.stamp.fill(0);
      this.closed.fill(0);
      this.generation = 0;
    }
    const gen = ++this.generation;
    const cols = this.cols;
    const gx = goalIdx % cols;
    const gy = Math.floor(goalIdx / cols);
    const heuristic = (i: number) => {
      const dx = Math.abs((i % cols) - gx);
      const dy = Math.abs(Math.floor(i / cols) - gy);
      return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
    };

    this.heap.clear();
    this.stamp[startIdx] = gen;
    this.gScore[startIdx] = 0;
    this.parent[startIdx] = -1;
    this.heap.push(startIdx, heuristic(startIdx));

    while (this.heap.size > 0) {
      const current = this.heap.pop();
      if (current === goalIdx) return this.reconstruct(goalIdx);
      if (this.closed[current] === gen) continue;
      this.closed[current] = gen;

      const cx = current % cols;
      const cy = Math.floor(current / cols);
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= this.rows) continue;
        const ni = ny * cols + nx;
        if (!this.walkable[ni] || this.closed[ni] === gen) continue;
        // No corner cutting through walls.
        if (dx !== 0 && dy !== 0 && (!this.walkable[cy * cols + nx] || !this.walkable[ny * cols + cx])) continue;
        const g = this.gScore[current] + cost;
        if (this.stamp[ni] !== gen || g < this.gScore[ni]) {
          this.stamp[ni] = gen;
          this.gScore[ni] = g;
          this.parent[ni] = current;
          this.heap.push(ni, g + heuristic(ni));
        }
      }
    }
    return null;
  }

  private reconstruct(goalIdx: number): number[] {
    const out: number[] = [];
    for (let i = goalIdx; i !== -1; i = this.parent[i]) out.push(i);
    out.reverse();
    out.shift();
    return out;
  }

  /** Greedy string pulling: skip every waypoint still visible from the current anchor. */
  private smooth(start: Vec2, points: Vec2[]): Vec2[] {
    const out: Vec2[] = [];
    let anchor = start;
    let i = 0;
    while (i < points.length) {
      let k = i;
      while (k + 1 < points.length && this.hasLineOfSight(anchor, points[k + 1])) k++;
      out.push(points[k]);
      anchor = points[k];
      i = k + 1;
    }
    return out;
  }
}

let shared: NavGrid | null = null;

/** The rift's nav grid is static, so it is built once and shared by every game. */
export function getNavGrid(): NavGrid {
  shared ??= new NavGrid(MAP_SIZE, NAV_CELL_SIZE, isTerrainWalkable);
  return shared;
}
