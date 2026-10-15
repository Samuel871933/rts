import { MONSTER_STATS, type CampState, type Game, type Team } from '@macrogod/shared';
import { Container, Graphics, Text } from 'pixi.js';
import { formatClock } from '../../../i18n/labels';
import { toView } from '../Camera';
import { CAMP_COLORS } from '../theme';

const ICON_PX = 8;
const EPIC_ICON_PX = 11;

/**
 * Jungle timers, drawn above the fog from the team's own knowledge of each camp:
 * an icon while it is up, a countdown when the team saw it die, "?" when found empty.
 */
export class CampLayer extends Container {
  private readonly shapes = new Graphics();
  private readonly labels = new Map<string, Text>();

  constructor(
    private readonly game: Game,
    private readonly team: Team,
  ) {
    super();
    this.addChild(this.shapes);
  }

  update(upp: number) {
    const g = this.shapes;
    g.clear();
    const time = this.game.state.time;

    for (const camp of this.game.state.camps) {
      const intel = camp.intel[this.team];
      const p = toView(camp.def.pos);
      const label = this.timerLabel(camp);
      label.visible = false;

      if (intel.status === 'up') {
        // The real monster is drawn by the unit layer while we see it.
        const monster = camp.unitId !== null ? this.game.get(camp.unitId) : undefined;
        if (monster?.visible[this.team]) continue;
        const r = (MONSTER_STATS[camp.def.kind].epic ? EPIC_ICON_PX : ICON_PX) * upp;
        g.circle(p.x, p.y, r).fill({ color: CAMP_COLORS[camp.def.kind], alpha: 0.9 }).stroke({ width: 1.5 * upp, color: 0x0b1016 });
        g.circle(p.x, p.y, r * 0.35).fill({ color: 0x0b1016, alpha: 0.7 });
        continue;
      }

      const text = intel.status === 'down' && intel.respawnAt !== null ? formatClock(intel.respawnAt - time) : '?';
      if (label.text !== text) label.text = text;
      label.visible = true;
      label.scale.set(upp);
      label.position.set(p.x, p.y);
      const w = label.width + 8 * upp;
      const h = label.height + 2 * upp;
      g.roundRect(p.x - w / 2, p.y - h / 2, w, h, 4 * upp)
        .fill({ color: 0x0b1016, alpha: 0.85 })
        .stroke({ width: 1.5 * upp, color: CAMP_COLORS[camp.def.kind], alpha: intel.status === 'down' ? 0.9 : 0.4 });
    }
  }

  private timerLabel(camp: CampState): Text {
    let label = this.labels.get(camp.def.id);
    if (!label) {
      label = new Text({
        text: '',
        style: { fontFamily: 'Inter', fontSize: 12, fontWeight: '700', fill: 0xe6edf7 },
      });
      label.anchor.set(0.5);
      this.addChild(label);
      this.labels.set(camp.def.id, label);
    }
    return label;
  }
}
