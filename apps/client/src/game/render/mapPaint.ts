import { CAMPS, FOUNTAINS, LANE_PATHS, LANE_WIDTH, MAP_SIZE, TERRAIN, isTerrainWalkable } from '@macrogod/shared';
import { toView } from './Camera';
import { terrainLoops, type Loop } from './terrainContours';
import { MAP_COLORS } from './theme';

const WALKABLE = [TERRAIN.ground, TERRAIN.river, TERRAIN.base];

function tracePath(ctx: CanvasRenderingContext2D, loops: Loop[]) {
  ctx.beginPath();
  for (const loop of loops) {
    ctx.moveTo(loop[0].x, loop[0].y);
    for (let i = 1; i < loop.length; i++) ctx.lineTo(loop[i].x, loop[i].y);
    ctx.closePath();
  }
}

function fillLoops(ctx: CanvasRenderingContext2D, loops: Loop[], color: string) {
  tracePath(ctx, loops);
  ctx.fillStyle = color;
  ctx.fill('evenodd');
}

/** Tree canopies over the walls so the terrain reads as forest, not void. */
function paintForest(ctx: CanvasRenderingContext2D) {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 2600; i++) {
    const x = rand() * MAP_SIZE;
    const y = rand() * MAP_SIZE;
    const r = 90 + rand() * 160;
    const color = rand() > 0.5 ? '#14261b' : '#112016';
    if (isTerrainWalkable({ x, y: MAP_SIZE - y })) continue;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Clips to the blue (bottom-left) or red (top-right) half of the map, split along the mid diagonal. */
function clipToSide(ctx: CanvasRenderingContext2D, side: 'blue' | 'red') {
  ctx.beginPath();
  // In view space (y down) the blue base is bottom-left: below the line from (0, 0) to (size, size).
  ctx.moveTo(0, 0);
  ctx.lineTo(MAP_SIZE, MAP_SIZE);
  ctx.lineTo(side === 'blue' ? 0 : MAP_SIZE, side === 'blue' ? MAP_SIZE : 0);
  ctx.closePath();
  ctx.clip();
}

/**
 * Summoner's Rift terrain painted on a 2D canvas of `px` pixels: forest walls, paths, river, bases,
 * lanes and fountains. Used by the map layer as a texture.
 */
export function paintMap(ctx: CanvasRenderingContext2D, px: number) {
  ctx.save();
  ctx.scale(px / MAP_SIZE, px / MAP_SIZE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = MAP_COLORS.wall;
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  paintForest(ctx);

  const walkable = terrainLoops(WALKABLE);
  fillLoops(ctx, walkable, MAP_COLORS.ground);
  for (const side of ['blue', 'red'] as const) {
    ctx.save();
    clipToSide(ctx, side);
    fillLoops(ctx, terrainLoops([TERRAIN.base]), side === 'blue' ? MAP_COLORS.baseBlue : MAP_COLORS.baseRed);
    ctx.restore();
  }
  fillLoops(ctx, terrainLoops([TERRAIN.river]), MAP_COLORS.river);

  // Lanes and camp marks stay inside the walkable terrain.
  ctx.save();
  tracePath(ctx, walkable);
  ctx.clip('evenodd');
  for (const [color, width] of [
    [MAP_COLORS.laneEdge, LANE_WIDTH * 0.75],
    [MAP_COLORS.laneDirt, LANE_WIDTH * 0.45],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const points of Object.values(LANE_PATHS)) {
      ctx.beginPath();
      points.map(toView).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 24;
  for (const camp of CAMPS) {
    const p = toView(camp.pos);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 140, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (const [team, color] of [
    ['blue', MAP_COLORS.fountainBlue],
    ['red', MAP_COLORS.fountainRed],
  ] as const) {
    const p = toView(FOUNTAINS[team]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 650, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 80;
  ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);
  ctx.restore();
}
