import { MAP_SIZE, clamp, type Vec2 } from '@macrogod/shared';
import type { Container } from 'pixi.js';

/**
 * World coordinates follow LoL (y up, blue base bottom-left). The renderer draws in "view" space,
 * which is the same with y flipped so that y grows downward like the screen.
 */
export const toView = (p: Vec2): Vec2 => ({ x: p.x, y: MAP_SIZE - p.y });
export const viewToWorld = toView;

export class Camera {
  /** Camera center, in view space. */
  x = MAP_SIZE / 2;
  y = MAP_SIZE / 2;
  /** Fixed zoom: the whole map fits the viewport (no zoom in / out). */
  zoom = 0.05;
  width = 1;
  height = 1;
  private fitted = true;

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.zoom = (Math.min(width, height) / MAP_SIZE) * 0.97;
    if (this.fitted) this.fitMap();
    else this.clampPosition();
  }

  /** Whole map, centered in the viewport. */
  fitMap() {
    this.x = MAP_SIZE / 2;
    this.y = MAP_SIZE / 2;
    this.fitted = true;
  }

  apply(container: Container) {
    container.scale.set(this.zoom);
    container.position.set(this.width / 2 - this.x * this.zoom, this.height / 2 - this.y * this.zoom);
  }

  /** World units per screen pixel: used to keep markers a constant on-screen size. */
  get unitsPerPixel(): number {
    return 1 / this.zoom;
  }

  screenToView(sx: number, sy: number): Vec2 {
    return { x: this.x + (sx - this.width / 2) / this.zoom, y: this.y + (sy - this.height / 2) / this.zoom };
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return viewToWorld(this.screenToView(sx, sy));
  }

  worldToScreen(p: Vec2): Vec2 {
    const v = toView(p);
    return { x: (v.x - this.x) * this.zoom + this.width / 2, y: (v.y - this.y) * this.zoom + this.height / 2 };
  }

  panBy(dxScreen: number, dyScreen: number) {
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.fitted = false;
    this.clampPosition();
  }

  centerOnWorld(p: Vec2) {
    const v = toView(p);
    this.x = v.x;
    this.y = v.y;
    this.fitted = false;
    this.clampPosition();
  }

  /** Visible area in world coordinates. */
  worldRect() {
    const halfW = this.width / 2 / this.zoom;
    const halfH = this.height / 2 / this.zoom;
    return {
      minX: this.x - halfW,
      maxX: this.x + halfW,
      minY: MAP_SIZE - (this.y + halfH),
      maxY: MAP_SIZE - (this.y - halfH),
    };
  }

  /** Keep the view inside the map; on an axis where the whole map fits, keep it centered. */
  private clampPosition() {
    const halfW = this.width / 2 / this.zoom;
    const halfH = this.height / 2 / this.zoom;
    this.x = halfW * 2 >= MAP_SIZE ? MAP_SIZE / 2 : clamp(this.x, halfW, MAP_SIZE - halfW);
    this.y = halfH * 2 >= MAP_SIZE ? MAP_SIZE / 2 : clamp(this.y, halfH, MAP_SIZE - halfH);
  }
}
