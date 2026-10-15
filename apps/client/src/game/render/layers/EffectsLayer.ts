import type { Game, GameEventRecord, Team, Vec2 } from '@macrogod/shared';
import { Graphics } from 'pixi.js';
import { toView } from '../Camera';
import { COLORS, TEAM_COLORS } from '../theme';
import { isShownTo } from './UnitLayer';

type Effect =
  | { kind: 'projectile'; from: Vec2; toId: number; to: Vec2; color: number; start: number; duration: number }
  | { kind: 'flash'; at: Vec2; color: number; radius: number; start: number; duration: number }
  | { kind: 'ring'; at: Vec2; color: number; radius: number; start: number; duration: number }
  | { kind: 'beam'; from: Vec2; to: Vec2; color: number; start: number; duration: number }
  | { kind: 'marker'; at: Vec2; color: number; start: number; duration: number };

const MAX_EFFECTS = 400;

/** Short-lived visuals driven by simulation events (attacks, spells, deaths) and player clicks. */
export class EffectsLayer extends Graphics {
  /** Named to avoid Pixi's own Container.effects. */
  private active: Effect[] = [];

  constructor(
    private readonly game: Game,
    private readonly team: Team,
  ) {
    super();
  }

  handle(events: GameEventRecord[]) {
    const now = performance.now();
    for (const e of events) {
      switch (e.type) {
        case 'attack': {
          const from = this.game.get(e.from);
          const to = this.game.get(e.to);
          if (!from || !to || !(isShownTo(from, this.team) || isShownTo(to, this.team))) break;
          const color = from.team === 'neutral' ? TEAM_COLORS.neutral : TEAM_COLORS[from.team];
          if (e.ranged) {
            this.add({ kind: 'projectile', from: toView(from.pos), toId: to.id, to: toView(to.pos), color, start: now, duration: 160 });
          } else {
            this.add({ kind: 'flash', at: toView(to.pos), color, radius: 45, start: now, duration: 120 });
          }
          break;
        }
        case 'ability': {
          const from = this.game.get(e.from);
          if (!from || !isShownTo(from, this.team)) break;
          if (e.kind === 'aoe') this.add({ kind: 'ring', at: toView(e.pos), color: COLORS.ability, radius: e.radius, start: now, duration: 380 });
          else if (e.kind === 'nuke') this.add({ kind: 'beam', from: toView(from.pos), to: toView(e.pos), color: COLORS.ability, start: now, duration: 220 });
          else if (e.kind === 'heal') this.add({ kind: 'ring', at: toView(e.pos), color: COLORS.heal, radius: 160, start: now, duration: 450 });
          else this.add({ kind: 'ring', at: toView(e.pos), color: COLORS.shield, radius: 130, start: now, duration: 450 });
          break;
        }
        case 'death':
          if (e.kind === 'champion' || e.kind === 'monster' || e.kind === 'turret' || e.kind === 'inhibitor' || e.kind === 'nexus') {
            this.add({ kind: 'ring', at: toView(e.pos), color: 0xffffff, radius: e.kind === 'monster' ? 300 : 500, start: now, duration: 600 });
          }
          break;
        case 'levelUp': {
          const c = this.game.champion(e.championId);
          if (c && c.team === this.team) this.add({ kind: 'ring', at: toView(c.pos), color: COLORS.selection, radius: 200, start: now, duration: 500 });
          break;
        }
        case 'wardPlaced':
          this.add({ kind: 'ring', at: toView(e.pos), color: COLORS.ward, radius: 250, start: now, duration: 500 });
          break;
      }
    }
  }

  /** Click feedback for orders, in world coordinates. */
  addMarker(world: Vec2, color: number) {
    this.add({ kind: 'marker', at: toView(world), color, start: performance.now(), duration: 450 });
  }

  private add(effect: Effect) {
    this.active.push(effect);
    if (this.active.length > MAX_EFFECTS) this.active.splice(0, this.active.length - MAX_EFFECTS);
  }

  update(now: number, upp: number) {
    this.clear();
    this.active = this.active.filter((fx) => now - fx.start < fx.duration);
    for (const fx of this.active) {
      const t = (now - fx.start) / fx.duration;
      switch (fx.kind) {
        case 'projectile': {
          const target = this.game.get(fx.toId);
          const to = target ? toView(target.pos) : fx.to;
          const x = fx.from.x + (to.x - fx.from.x) * t;
          const y = fx.from.y + (to.y - fx.from.y) * t;
          this.circle(x, y, Math.max(18, 2.2 * upp)).fill({ color: fx.color, alpha: 0.95 });
          break;
        }
        case 'flash':
          this.circle(fx.at.x, fx.at.y, Math.max(fx.radius, 4 * upp) * (0.6 + t)).fill({ color: fx.color, alpha: 0.5 * (1 - t) });
          break;
        case 'ring':
          this.circle(fx.at.x, fx.at.y, fx.radius * (0.4 + 0.6 * t)).stroke({ width: 3 * upp, color: fx.color, alpha: 1 - t });
          break;
        case 'beam':
          this.moveTo(fx.from.x, fx.from.y).lineTo(fx.to.x, fx.to.y).stroke({ width: 3 * upp, color: fx.color, alpha: 1 - t });
          break;
        case 'marker': {
          const r = (14 - 8 * t) * upp;
          this.circle(fx.at.x, fx.at.y, r).stroke({ width: 2.5 * upp, color: fx.color, alpha: 1 - t });
          break;
        }
      }
    }
  }
}
