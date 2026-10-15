import { MAP_SIZE, type Vec2 } from '@macrogod/shared';
import type { Container } from 'pixi.js';

/**
 * World coordinates follow LoL (y up, blue base bottom-left). The renderer draws in "view" space,
 * which is the same with y flipped so that y grows downward like the screen.
 */
export const toView = (p: Vec2): Vec2 => ({ x: p.x, y: MAP_SIZE - p.y });

/** Fixed view: the whole map, centered in the viewport (no zoom, no panning). */
export class Camera {
  zoom = 0.05;
  width = 1;
  height = 1;
  /** Screen position of the map's top-left corner. */
  private offsetX = 0;
  private offsetY = 0;

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.zoom = (Math.min(width, height) / MAP_SIZE) * 0.97;
    this.offsetX = (width - MAP_SIZE * this.zoom) / 2;
    this.offsetY = (height - MAP_SIZE * this.zoom) / 2;
  }

  apply(container: Container) {
    container.scale.set(this.zoom);
    container.position.set(this.offsetX, this.offsetY);
  }

  /** World units per screen pixel: used to keep markers a constant on-screen size. */
  get unitsPerPixel(): number {
    return 1 / this.zoom;
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return toView({ x: (sx - this.offsetX) / this.zoom, y: (sy - this.offsetY) / this.zoom });
  }

  worldToScreen(p: Vec2): Vec2 {
    const v = toView(p);
    return { x: v.x * this.zoom + this.offsetX, y: v.y * this.zoom + this.offsetY };
  }
}
