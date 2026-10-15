import {
  BARON_PIT,
  BASES,
  CLEARINGS,
  DRAGON_PIT,
  FOUNTAINS,
  JUNGLE_PATHS,
  LANE_PATHS,
  LANE_WIDTH,
  RIVER,
  type Vec2,
} from '@macrogod/shared';
import { toView } from './Camera';
import { MAP_COLORS } from './theme';

export type PaintOp =
  | { kind: 'path'; points: Vec2[]; width: number; color: string }
  | { kind: 'circle'; center: Vec2; radius: number; color: string }
  | { kind: 'ring'; center: Vec2; radius: number; width: number; color: string };

/**
 * Summoner's Rift as an ordered list of drawing operations, in view space.
 * Both the Pixi map layer and the canvas minimap paint from this list.
 */
export function buildMapPaint(): PaintOp[] {
  const ops: PaintOp[] = [];
  const path = (points: Vec2[], width: number, color: string) =>
    ops.push({ kind: 'path', points: points.map(toView), width, color });
  const circle = (center: Vec2, radius: number, color: string) =>
    ops.push({ kind: 'circle', center: toView(center), radius, color });

  for (const p of JUNGLE_PATHS) path(p.points, p.width, MAP_COLORS.jungle);
  for (const c of CLEARINGS) circle(c.center, c.radius, MAP_COLORS.clearing);
  path(RIVER.points, RIVER.width, MAP_COLORS.river);
  circle(BARON_PIT.center, BARON_PIT.radius, MAP_COLORS.pit);
  circle(DRAGON_PIT.center, DRAGON_PIT.radius, MAP_COLORS.pit);
  for (const pit of [BARON_PIT, DRAGON_PIT]) {
    ops.push({ kind: 'ring', center: toView(pit.center), radius: pit.radius, width: 60, color: MAP_COLORS.pitRing });
  }
  circle(BASES.blue.center, BASES.blue.radius, MAP_COLORS.baseBlue);
  circle(BASES.red.center, BASES.red.radius, MAP_COLORS.baseRed);
  for (const points of Object.values(LANE_PATHS)) path(points, LANE_WIDTH, MAP_COLORS.laneEdge);
  for (const points of Object.values(LANE_PATHS)) path(points, LANE_WIDTH * 0.55, MAP_COLORS.laneDirt);
  circle(FOUNTAINS.blue, 650, MAP_COLORS.fountainBlue);
  circle(FOUNTAINS.red, 650, MAP_COLORS.fountainRed);
  return ops;
}

/** Paints the ops on a 2D canvas context already scaled to view space. */
export function paintCanvas(ctx: CanvasRenderingContext2D, ops: PaintOp[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    if (op.kind === 'path') {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      op.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    } else if (op.kind === 'circle') {
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.arc(op.center.x, op.center.y, op.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      ctx.arc(op.center.x, op.center.y, op.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
