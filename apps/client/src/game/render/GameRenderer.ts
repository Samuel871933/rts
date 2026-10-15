import { dist, type CampState, type Unit, type Vec2 } from '@macrogod/shared';
import { Application, Container, Graphics } from 'pixi.js';
import type { GameSession } from '../core/GameSession';
import { Camera } from './Camera';
import { CampLayer } from './layers/CampLayer';
import { EffectsLayer } from './layers/EffectsLayer';
import { FogLayer } from './layers/FogLayer';
import { MapLayer } from './layers/MapLayer';
import { OverlayLayer } from './layers/OverlayLayer';
import { UnitLayer, displayRadius, isShownTo } from './layers/UnitLayer';
import { MAP_COLORS } from './theme';

/** Click reach (screen pixels) around a camp marker / timer. */
const CAMP_PICK_PX = 18;

/** Pixi scene of a match. Draws the session's game state each frame; owns no game logic. */
export class GameRenderer {
  readonly camera = new Camera();
  readonly effects: EffectsLayer;
  private readonly fog: FogLayer;
  /** Screen-space overlay for the drag-selection box. */
  readonly screenOverlay = new Graphics();
  /** Last known cursor position in world space (for ward / attack-move previews). */
  cursorWorld: Vec2 | null = null;

  private readonly world = new Container();
  private readonly units: UnitLayer;
  private readonly overlay: OverlayLayer;
  private readonly camps: CampLayer;
  private readonly unsubscribe: (() => void)[] = [];

  static async create(host: HTMLElement, session: GameSession): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: MAP_COLORS.wall,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
    });
    host.appendChild(app.canvas);
    return new GameRenderer(app, session, host);
  }

  private constructor(
    readonly app: Application,
    private readonly session: GameSession,
    host: HTMLElement,
  ) {
    const { game, team } = session;
    this.units = new UnitLayer(game, team);
    this.overlay = new OverlayLayer(game, team);
    this.effects = new EffectsLayer(game, team);
    this.fog = new FogLayer(game, team);
    this.camps = new CampLayer(game, team);

    this.world.addChild(new MapLayer(), this.overlay, this.units, this.effects, this.fog, this.camps);
    app.stage.addChild(this.world, this.screenOverlay);

    this.camera.resize(app.screen.width, app.screen.height);

    // Pixi only listens to window resizes; the stage also changes size when the HUD reflows.
    const observer = new ResizeObserver(() => app.resize());
    observer.observe(host);

    this.unsubscribe.push(
      () => observer.disconnect(),
      session.onFrame((alpha) => this.render(alpha)),
      session.onEvents((events) => this.effects.handle(events)),
    );
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  private render(alpha: number) {
    const { width, height } = this.app.screen;
    if (width !== this.camera.width || height !== this.camera.height) this.camera.resize(width, height);
    this.camera.apply(this.world);

    const now = performance.now();
    const upp = this.camera.unitsPerPixel;
    const { selection, commandMode } = this.session;
    this.units.update(alpha, upp, selection);
    this.overlay.update(alpha, upp, selection, commandMode, this.cursorWorld);
    this.effects.update(now, upp);
    this.fog.update(now);
    this.camps.update(upp);
    this.app.render();
  }

  /** Topmost visible unit under a screen point matching the filter. */
  pickUnit(sx: number, sy: number, filter: (u: Unit) => boolean): Unit | null {
    const world = this.camera.screenToWorld(sx, sy);
    const upp = this.camera.unitsPerPixel;
    let best: Unit | null = null;
    let bestDist = Infinity;
    for (const u of this.session.game.state.units.values()) {
      if (!u.alive || !isShownTo(u, this.session.team) || !filter(u)) continue;
      const d = dist(u.pos, world);
      const reach = displayRadius(u, upp) * (u.kind === 'champion' ? 1.3 : 1) + 6 * upp;
      if (d <= reach && d < bestDist) {
        best = u;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Jungle camp whose marker is under a screen point and whose monster is not in sight
   * (a visible monster is picked as a unit). Lets the player order a camp from the fog.
   */
  pickCamp(sx: number, sy: number): CampState | null {
    const world = this.camera.screenToWorld(sx, sy);
    const reach = CAMP_PICK_PX * this.camera.unitsPerPixel;
    let best: CampState | null = null;
    let bestDist = Infinity;
    for (const camp of this.session.game.state.camps) {
      const monster = camp.unitId !== null ? this.session.game.get(camp.unitId) : undefined;
      if (monster && isShownTo(monster, this.session.team)) continue;
      const d = dist(camp.def.pos, world);
      if (d <= reach && d < bestDist) {
        best = camp;
        bestDist = d;
      }
    }
    return best;
  }

  /** Screen position of a world point (for box selection). */
  toScreen(world: Vec2): Vec2 {
    return this.camera.worldToScreen(world);
  }

  destroy() {
    for (const off of this.unsubscribe) off();
    this.app.destroy({ removeView: true }, { children: true, texture: false });
  }
}
