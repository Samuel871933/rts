import { CAMPS, MAP_SIZE, type NavGrid } from '@macrogod/shared';
import { Container, Graphics } from 'pixi.js';
import { toView } from '../Camera';
import { buildMapPaint } from '../mapPaint';
import { MAP_COLORS } from '../theme';

/** Static terrain: drawn once as vector graphics so it stays crisp at every zoom level. */
export class MapLayer extends Container {
  constructor(nav: NavGrid) {
    super();
    const g = new Graphics();
    g.rect(0, 0, MAP_SIZE, MAP_SIZE).fill(MAP_COLORS.wall);
    this.drawForest(g, nav);

    for (const op of buildMapPaint()) {
      if (op.kind === 'path') {
        op.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
        g.stroke({ width: op.width, color: op.color, cap: 'round', join: 'round' });
      } else if (op.kind === 'circle') {
        g.circle(op.center.x, op.center.y, op.radius).fill(op.color);
      } else {
        g.circle(op.center.x, op.center.y, op.radius).stroke({ width: op.width, color: op.color });
      }
    }

    for (const camp of CAMPS) {
      const p = toView(camp.pos);
      g.circle(p.x, p.y, 140).stroke({ width: 24, color: 0x000000, alpha: 0.25 });
    }
    g.rect(0, 0, MAP_SIZE, MAP_SIZE).stroke({ width: 80, color: 0x000000, alpha: 0.6 });
    // Base circles overflow the map square: clip everything to the rift.
    const clip = new Graphics().rect(0, 0, MAP_SIZE, MAP_SIZE).fill(0xffffff);
    this.addChild(g, clip);
    this.mask = clip;
  }

  /** Scatter tree canopies over the walls so the terrain reads as forest, not void. */
  private drawForest(g: Graphics, nav: NavGrid) {
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 2600; i++) {
      const x = rand() * MAP_SIZE;
      const y = rand() * MAP_SIZE;
      if (nav.isWalkable({ x, y: MAP_SIZE - y })) continue;
      g.circle(x, y, 90 + rand() * 160).fill({ color: rand() > 0.5 ? 0x14261b : 0x112016, alpha: 0.9 });
    }
  }
}
