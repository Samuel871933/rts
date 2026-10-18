import {
  CAMPS,
  FOUNTAINS,
  JUNGLE_LINKS,
  JUNGLE_LINK_WIDTH,
  LANE_PATHS,
  LANE_WIDTH,
  MAP_SIZE,
  TERRAIN,
  TUNNEL_PATH,
  TUNNEL_WIDTH,
  isTerrainWalkable,
  type Vec2,
} from '@macrogod/shared';
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

/** Riveted brass plating over the walls, so the terrain reads as industrial hull, not void. */
function paintIndustrial(ctx: CanvasRenderingContext2D) {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 1900; i++) {
    const x = rand() * MAP_SIZE;
    const y = rand() * MAP_SIZE;
    const w = 160 + rand() * 260;
    const h = 160 + rand() * 260;
    if (isTerrainWalkable({ x, y: MAP_SIZE - y })) continue;
    ctx.fillStyle = rand() > 0.5 ? MAP_COLORS.wallPlate : MAP_COLORS.wall;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = MAP_COLORS.rivet;
    for (const [rx, ry] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      ctx.beginPath();
      ctx.arc(x + (rx * w) / 2 - rx * 24, y + (ry * h) / 2 - ry * 24, 7, 0, Math.PI * 2);
      ctx.fill();
    }
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

/** A regular hexagon outline centered at `p`, flat side up — the camp/relic marker motif. */
function strokeHex(ctx: CanvasRenderingContext2D, p: Vec2, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = p.x + Math.cos(a) * r;
    const y = p.y + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

/**
 * "The Spire" terrain painted on a 2D canvas of `px` pixels: riveted brass walls, paths, an arc-energy
 * river, bases and fountains. Used by the map layer as a texture.
 */
export function paintMap(ctx: CanvasRenderingContext2D, px: number) {
  ctx.save();
  ctx.scale(px / MAP_SIZE, px / MAP_SIZE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = MAP_COLORS.wall;
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  paintIndustrial(ctx);

  const walkable = terrainLoops(WALKABLE);
  fillLoops(ctx, walkable, MAP_COLORS.ground);
  for (const side of ['blue', 'red'] as const) {
    ctx.save();
    clipToSide(ctx, side);
    fillLoops(ctx, terrainLoops([TERRAIN.base]), side === 'blue' ? MAP_COLORS.baseBlue : MAP_COLORS.baseRed);
    ctx.restore();
  }
  const riverLoops = terrainLoops([TERRAIN.river]);
  fillLoops(ctx, riverLoops, MAP_COLORS.river);
  ctx.save();
  ctx.strokeStyle = MAP_COLORS.riverGlow;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 50;
  tracePath(ctx, riverLoops);
  ctx.stroke();
  ctx.restore();

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
  // Camp-to-camp jungle paths: a thin worn track, same idiom as the lane dirt stroke.
  ctx.strokeStyle = MAP_COLORS.laneDirt;
  ctx.lineWidth = JUNGLE_LINK_WIDTH * 0.5;
  for (const { a, b } of JUNGLE_LINKS) {
    const pa = toView(a);
    const pb = toView(b);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  ctx.strokeStyle = MAP_COLORS.rivet;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 18;
  for (const camp of CAMPS) strokeHex(ctx, toView(camp.pos), 150);
  ctx.globalAlpha = 1;

  // Maintenance tunnel: a darker, dashed passage (enclosed, unlike the open lanes) with lit mouths.
  ctx.strokeStyle = MAP_COLORS.tunnel;
  ctx.lineWidth = TUNNEL_WIDTH;
  ctx.setLineDash([60, 90]);
  ctx.beginPath();
  TUNNEL_PATH.map(toView).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  for (const end of [TUNNEL_PATH[0], TUNNEL_PATH[TUNNEL_PATH.length - 1]]) {
    const p = toView(end);
    ctx.fillStyle = MAP_COLORS.tunnelMouth;
    ctx.beginPath();
    ctx.rect(p.x - 90, p.y - 90, 180, 180);
    ctx.fill();
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
