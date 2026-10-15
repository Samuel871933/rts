import { MONSTER_STATS, isTargetable, lerpVec, type CampKind, type Game, type Team, type Unit, type Vec2 } from '@macrogod/shared';
import { Container, Graphics, Text } from 'pixi.js';
import { toView } from '../Camera';
import { COLORS, TEAM_COLORS, TEAM_DARK } from '../theme';
import { ChampionToken, TOKEN_RADIUS } from './ChampionToken';

export const isShownTo = (u: Unit, team: Team) => u.team === team || u.visible[team];

export const renderPos = (u: Unit, alpha: number): Vec2 => toView(lerpVec(u.prevPos, u.pos, alpha));

/** Minimum on-screen radius (pixels) per unit type, so the macro view stays readable when zoomed out. */
const MIN_PX = { champion: 15, minion: 3.2, siege: 4.4, monster: 7, epic: 13, turret: 9, inhibitor: 9, nexus: 14, ward: 4 };

export function displayRadius(u: Unit, upp: number): number {
  let minPx: number;
  switch (u.kind) {
    case 'minion':
      minPx = u.minionType === 'melee' || u.minionType === 'caster' ? MIN_PX.minion : MIN_PX.siege;
      break;
    case 'monster':
      minPx = u.epic ? MIN_PX.epic : MIN_PX.monster;
      break;
    default:
      minPx = MIN_PX[u.kind];
  }
  return Math.max(u.radius, minPx * upp);
}

/** All dynamic units. Shapes and bars are redrawn every frame into two batched Graphics. */
export class UnitLayer extends Container {
  private readonly shapes = new Graphics();
  private readonly tokens = new Container();
  private readonly bars = new Graphics();
  private readonly labels = new Container();
  private readonly tokenById = new Map<number, ChampionToken>();
  private readonly labelById = new Map<number, Text>();

  constructor(
    private readonly game: Game,
    private readonly team: Team,
  ) {
    super();
    this.addChild(this.shapes, this.tokens, this.bars, this.labels);
    for (const c of game.state.champions) {
      const token = new ChampionToken(c);
      this.tokenById.set(c.id, token);
      this.tokens.addChild(token);
    }
  }

  update(alpha: number, upp: number, selection: Set<number>) {
    const g = this.shapes;
    const bars = this.bars;
    g.clear();
    bars.clear();
    const seenLabels = new Set<number>();
    const time = this.game.state.time;

    for (const u of this.game.state.units.values()) {
      if (u.kind === 'champion') continue;
      if (!isShownTo(u, this.team)) continue;
      const p = renderPos(u, alpha);
      const r = displayRadius(u, upp);

      switch (u.kind) {
        case 'turret': {
          if (!u.alive) {
            g.circle(p.x, p.y, r * 0.8).fill({ color: COLORS.rubble, alpha: 0.9 });
            break;
          }
          const locked = !isTargetable(this.game, u);
          g.roundRect(p.x - r, p.y - r, r * 2, r * 2, r * 0.3)
            .fill(TEAM_DARK[u.team])
            .stroke({ width: 2.5 * upp, color: TEAM_COLORS[u.team], alpha: locked ? 0.55 : 1 });
          g.circle(p.x, p.y, r * 0.38).fill(TEAM_COLORS[u.team]);
          this.drawBar(bars, u, p, r, upp);
          break;
        }
        case 'inhibitor': {
          if (!u.alive) {
            g.circle(p.x, p.y, r).stroke({ width: 2 * upp, color: COLORS.dead });
            break;
          }
          g.poly([p.x, p.y - r, p.x + r, p.y, p.x, p.y + r, p.x - r, p.y])
            .fill(TEAM_DARK[u.team])
            .stroke({ width: 2.5 * upp, color: TEAM_COLORS[u.team] });
          this.drawBar(bars, u, p, r, upp);
          break;
        }
        case 'nexus': {
          const pts: number[] = [];
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i + Math.PI / 6;
            pts.push(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
          }
          g.poly(pts)
            .fill(u.alive ? TEAM_DARK[u.team] : COLORS.rubble)
            .stroke({ width: 3 * upp, color: u.alive ? TEAM_COLORS[u.team] : COLORS.dead });
          if (u.alive) this.drawBar(bars, u, p, r, upp);
          break;
        }
        case 'minion': {
          const color = TEAM_COLORS[u.team];
          if (u.minionType === 'siege' || u.minionType === 'super') {
            g.rect(p.x - r, p.y - r, r * 2, r * 2).fill(color).stroke({ width: 1.5 * upp, color: 0x000000, alpha: 0.6 });
          } else {
            g.circle(p.x, p.y, r).fill({ color, alpha: u.minionType === 'caster' ? 0.75 : 1 });
          }
          if (u.hp < u.maxHp && upp < 9) this.drawBar(bars, u, p, r, upp, 0.6);
          break;
        }
        case 'monster': {
          g.circle(p.x, p.y, r)
            .fill(u.epic ? 0x6d3fc0 : TEAM_DARK.neutral)
            .stroke({ width: 2 * upp, color: u.epic ? 0xc9a8ff : TEAM_COLORS.neutral });
          if (u.hp < u.maxHp) this.drawBar(bars, u, p, r, upp);
          if (u.epic) {
            this.showLabel(u.id, MONSTER_STATS[this.campKind(u.campId)].name, p, r, upp);
            seenLabels.add(u.id);
          }
          break;
        }
        case 'ward': {
          g.circle(p.x, p.y, u.sight).fill({ color: COLORS.ward, alpha: 0.05 });
          g.poly([p.x, p.y - r, p.x + r * 0.7, p.y, p.x, p.y + r, p.x - r * 0.7, p.y]).fill(COLORS.ward);
          break;
        }
      }
    }

    for (const c of this.game.state.champions) {
      const token = this.tokenById.get(c.id)!;
      const visible = c.alive && isShownTo(c, this.team);
      token.visible = visible;
      if (!visible) continue;
      const p = renderPos(c, alpha);
      const r = displayRadius(c, upp);
      token.position.set(p.x, p.y);
      token.scale.set(r / TOKEN_RADIUS);
      token.setLevel(c.level);

      if (selection.has(c.id)) {
        g.circle(p.x, p.y, r * 1.32).stroke({ width: 3 * upp, color: COLORS.selection });
      }
      g.circle(p.x, p.y, r * 1.12).fill(TEAM_COLORS[c.team]);
      if (c.buffs.baron > time) g.circle(p.x, p.y, r * 1.2).stroke({ width: 2 * upp, color: 0xb48cff });
      if (c.recallTimer !== null) {
        g.circle(p.x, p.y, r * 1.5).stroke({ width: 2 * upp, color: 0x6fb8ff, alpha: 0.8 });
      }
      this.drawBar(bars, c, p, r * 1.15, upp, 1.3);
    }

    for (const [id, label] of this.labelById) {
      if (!seenLabels.has(id)) {
        label.destroy();
        this.labelById.delete(id);
      }
    }
  }

  private campKind(campId: string): CampKind {
    return this.game.state.camps.find((c) => c.def.id === campId)!.def.kind;
  }

  private drawBar(g: Graphics, u: Unit, p: Vec2, r: number, upp: number, scale = 1) {
    const w = Math.max(r * 2, 30 * upp) * scale;
    const h = 4 * upp * scale;
    const x = p.x - w / 2;
    const y = p.y - r - h - 4 * upp;
    const ratio = Math.max(0, u.hp / u.maxHp);
    const color = u.team === this.team ? COLORS.hpAlly : u.team === 'neutral' ? COLORS.hpNeutral : COLORS.hpEnemy;
    g.rect(x - upp, y - upp, w + 2 * upp, h + 2 * upp).fill({ color: COLORS.hpBack, alpha: 0.85 });
    g.rect(x, y, w * ratio, h).fill(color);
    if (u.kind === 'champion' && u.shield > 0) {
      g.rect(x + w * ratio, y, Math.min(w * (1 - ratio), (u.shield / u.maxHp) * w), h).fill(COLORS.shield);
    }
  }

  private showLabel(id: number, text: string, p: Vec2, r: number, upp: number) {
    let label = this.labelById.get(id);
    if (!label) {
      label = new Text({ text, style: { fontFamily: 'Rajdhani', fontSize: 16, fontWeight: '700', fill: 0xe3d2ff } });
      label.anchor.set(0.5, 0);
      this.labels.addChild(label);
      this.labelById.set(id, label);
    }
    label.scale.set(upp);
    label.position.set(p.x, p.y + r + 4 * upp);
  }
}
