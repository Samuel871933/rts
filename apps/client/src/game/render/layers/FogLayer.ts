import { MAP_SIZE, type Game, type Team } from '@macrogod/shared';
import { Sprite, Texture } from 'pixi.js';
import { FOG_COLOR } from '../theme';

const RESOLUTION = 256;
const REFRESH_MS = 90;

/**
 * Fog of war overlay: a low-res canvas, dark everywhere except around the team's vision sources,
 * stretched over the map (linear filtering gives soft edges for free).
 */
export class FogLayer extends Sprite {
  private readonly ctx: CanvasRenderingContext2D;
  private lastDraw = 0;
  /** Vision only changes when the game steps: nothing to redraw while paused. */
  private lastTick = -1;

  constructor(
    private readonly game: Game,
    private readonly team: Team,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = RESOLUTION;
    super(Texture.from(canvas));
    this.ctx = canvas.getContext('2d')!;
    this.width = this.height = MAP_SIZE;
    this.redraw();
  }

  update(now: number) {
    const { tick } = this.game.state;
    if (tick === this.lastTick || now - this.lastDraw < REFRESH_MS) return;
    this.lastDraw = now;
    this.lastTick = tick;
    this.redraw();
    this.texture.source.update();
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]) {
    const texture = this.texture;
    super.destroy(options);
    texture.destroy(true);
  }

  private redraw() {
    const { ctx } = this;
    const k = RESOLUTION / MAP_SIZE;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, RESOLUTION, RESOLUTION);
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(0, 0, RESOLUTION, RESOLUTION);
    ctx.globalCompositeOperation = 'destination-out';
    for (const u of this.game.state.units.values()) {
      if (!u.alive || u.team !== this.team || u.sight <= 0) continue;
      const x = u.pos.x * k;
      const y = (MAP_SIZE - u.pos.y) * k;
      const r = u.sight * k;
      const gradient = ctx.createRadialGradient(x, y, r * 0.75, x, y, r);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
