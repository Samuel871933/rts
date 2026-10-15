import { CHAMPIONS_BY_ID, getChampionIcon, type ChampionUnit } from '@macrogod/shared';
import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { TEAM_COLORS, TEAM_DARK } from '../theme';

/** Token radius in its local space; the layer scales it to keep a constant on-screen size. */
export const TOKEN_RADIUS = 32;

const RESUME_COLOR = 0xf5b84a;

/**
 * A champion portrait in a team-colored disc. Its level badge and farm auto countdown live in
 * `overlay`, drawn in a layer above every portrait so an overlapping champion never hides them.
 */
export class ChampionToken extends Container {
  readonly overlay = new Container();
  private readonly levelText: Text;
  private lastLevel = 0;
  private readonly resume = new Container();
  private readonly resumeText: Text;
  private lastResume: number | null = null;

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
    this.overlay.addChild(badge, this.levelText);

    // Clock + "12s": seconds before farm auto sends it back to its post, above the portrait.
    const pill = new Graphics()
      .roundRect(-32, -13, 64, 26, 13)
      .fill(0x0b1016)
      .stroke({ width: 2, color: RESUME_COLOR });
    const clock = new Graphics()
      .circle(-17, 0, 7)
      .stroke({ width: 2, color: RESUME_COLOR })
      .moveTo(-17, 0)
      .lineTo(-17, -4.5)
      .moveTo(-17, 0)
      .lineTo(-13.5, 2)
      .stroke({ width: 2, color: RESUME_COLOR, cap: 'round' });
    this.resumeText = new Text({
      text: '',
      style: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', fill: RESUME_COLOR },
    });
    this.resumeText.anchor.set(0, 0.5);
    this.resumeText.position.set(-6, 0);
    this.resume.addChild(pill, clock, this.resumeText);
    this.resume.position.set(0, -TOKEN_RADIUS - 22);
    this.resume.visible = false;
    this.overlay.addChild(this.resume);
  }

  setLevel(level: number) {
    if (level === this.lastLevel) return;
    this.lastLevel = level;
    this.levelText.text = String(level);
  }

  /** Seconds before returning to its post (farm auto), or null to hide. */
  setResumeIn(seconds: number | null) {
    const shown = seconds === null ? null : Math.ceil(seconds);
    if (shown === this.lastResume) return;
    this.lastResume = shown;
    this.resume.visible = shown !== null;
    if (shown !== null) this.resumeText.text = `${shown}s`;
  }

  /** Follows the portrait (call after moving / scaling it). */
  syncOverlay() {
    this.overlay.visible = this.visible;
    if (!this.visible) return;
    this.overlay.position.copyFrom(this.position);
    this.overlay.scale.copyFrom(this.scale);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.overlay.destroy(options);
    super.destroy(options);
  }
}
