import { CHAMPIONS_BY_ID, getChampionIcon, type ChampionUnit } from '@macrogod/shared';
import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { TEAM_COLORS, TEAM_DARK } from '../theme';

/** Token radius in its local space; the layer scales it to keep a constant on-screen size. */
export const TOKEN_RADIUS = 32;

/** A champion portrait in a team-colored disc, with its level badge. */
export class ChampionToken extends Container {
  private readonly levelText: Text;
  private lastLevel = 0;

  constructor(champion: ChampionUnit) {
    super();
    const def = CHAMPIONS_BY_ID[champion.defId];

    const disc = new Graphics()
      .circle(0, 0, TOKEN_RADIUS)
      .fill(TEAM_DARK[champion.team]);
    const initials = new Text({
      text: def.name.slice(0, 2),
      style: { fontFamily: 'Inter', fontSize: 22, fontWeight: '700', fill: 0xffffff },
    });
    initials.anchor.set(0.5);
    this.addChild(disc, initials);

    const mask = new Graphics().circle(0, 0, TOKEN_RADIUS - 2).fill(0xffffff);
    const icon = new Sprite();
    icon.anchor.set(0.5);
    icon.mask = mask;
    this.addChild(icon, mask);
    Assets.load<Texture>(getChampionIcon(def))
      .then((texture) => {
        if (icon.destroyed) return;
        icon.texture = texture;
        icon.width = icon.height = TOKEN_RADIUS * 2.25;
        initials.visible = false;
      })
      .catch(() => undefined);

    const badge = new Graphics()
      .circle(TOKEN_RADIUS * 0.72, TOKEN_RADIUS * 0.72, 13)
      .fill(0x0b1016)
      .stroke({ width: 2, color: TEAM_COLORS[champion.team] });
    this.levelText = new Text({
      text: '1',
      style: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', fill: 0xf0d58a },
    });
    this.levelText.anchor.set(0.5);
    this.levelText.position.set(TOKEN_RADIUS * 0.72, TOKEN_RADIUS * 0.72);
    this.addChild(badge, this.levelText);
  }

  setLevel(level: number) {
    if (level === this.lastLevel) return;
    this.lastLevel = level;
    this.levelText.text = String(level);
  }
}
