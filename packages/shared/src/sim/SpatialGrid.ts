import { MAP_SIZE } from '../constants';
import { dist2, type Vec2 } from '../math';

interface Positioned {
  pos: Vec2;
}

/** Uniform bucket grid, rebuilt every tick, for radius queries. */
export class SpatialGrid<T extends Positioned> {
  private readonly cols: number;
  private readonly buckets: T[][];

  constructor(private readonly cellSize: number) {
    this.cols = Math.ceil(MAP_SIZE / cellSize);
    this.buckets = Array.from({ length: this.cols * this.cols }, () => []);
  }

  private cellCoord(v: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(v / this.cellSize)));
  }

  clear() {
    for (const b of this.buckets) b.length = 0;
  }

  insert(item: T) {
    this.buckets[this.cellCoord(item.pos.y) * this.cols + this.cellCoord(item.pos.x)].push(item);
  }

  /** Items whose position is within `radius` of `center`. */
  query(center: Vec2, radius: number, out: T[] = []): T[] {
    const x0 = this.cellCoord(center.x - radius);
    const x1 = this.cellCoord(center.x + radius);
    const y0 = this.cellCoord(center.y - radius);
    const y1 = this.cellCoord(center.y + radius);
    const r2 = radius * radius;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (const item of this.buckets[cy * this.cols + cx]) {
          if (dist2(item.pos, center) <= r2) out.push(item);
        }
      }
    }
    return out;
  }
}
