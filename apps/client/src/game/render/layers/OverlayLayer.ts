import { RULES, dist, enemyOf, type Game, type Team, type Vec2 } from '@macrogod/shared';
import { Graphics } from 'pixi.js';
import type { CommandMode } from '../../core/hudSnapshot';
import { toView } from '../Camera';
import { COLORS } from '../theme';
import { renderPos } from './UnitLayer';

/** Order feedback for the selection: planned paths, destinations, ward range and nearby turret ranges. */
export class OverlayLayer extends Graphics {
  constructor(
    private readonly game: Game,
    private readonly team: Team,
  ) {
    super();
  }

  update(alpha: number, upp: number, selection: Set<number>, mode: CommandMode, cursorWorld: Vec2 | null) {
    this.clear();
    const selected = this.game.state.champions.filter((c) => selection.has(c.id) && c.alive);

    for (const c of selected) {
      const p = renderPos(c, alpha);
      if (c.path.length > 0) {
        this.moveTo(p.x, p.y);
        for (const wp of c.path) {
          const v = toView(wp);
          this.lineTo(v.x, v.y);
        }
        this.stroke({ width: 2 * upp, color: COLORS.orderMove, alpha: 0.45 });
        const end = toView(c.path[c.path.length - 1]);
        this.circle(end.x, end.y, 5 * upp).fill({ color: COLORS.orderMove, alpha: 0.7 });
      }
      if (c.targetId !== null) {
        const t = this.game.get(c.targetId);
        if (t?.alive) {
          const tp = renderPos(t, alpha);
          this.moveTo(p.x, p.y).lineTo(tp.x, tp.y).stroke({ width: 1.5 * upp, color: COLORS.orderAttack, alpha: 0.5 });
        }
      }
      this.circle(p.x, p.y, c.range + c.radius).stroke({ width: 1 * upp, color: 0xffffff, alpha: 0.12 });
    }

    // Enemy turret ranges near the selection: the key macro danger zones.
    const enemy = enemyOf(this.team);
    for (const s of this.game.state.structures) {
      if (s.kind !== 'turret' || !s.alive || s.team !== enemy) continue;
      if (!selected.some((c) => dist(c.pos, s.pos) < s.range + 900)) continue;
      const v = toView(s.pos);
      this.circle(v.x, v.y, s.range).stroke({ width: 2 * upp, color: COLORS.orderAttack, alpha: 0.35 });
    }

    if (mode === 'ward' && cursorWorld) {
      const v = toView(cursorWorld);
      this.circle(v.x, v.y, RULES.wardSight).fill({ color: COLORS.ward, alpha: 0.08 }).stroke({ width: 2 * upp, color: COLORS.ward, alpha: 0.6 });
    }
    if (mode === 'attackMove' && cursorWorld) {
      const v = toView(cursorWorld);
      this.circle(v.x, v.y, 10 * upp).stroke({ width: 2 * upp, color: COLORS.orderAttack });
    }
  }
}
