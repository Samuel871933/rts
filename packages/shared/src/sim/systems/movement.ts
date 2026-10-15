import { dist, type Vec2 } from '../../math';
import type { Game } from '../Game';
import type { Unit } from '../types';

/** Re-plan only when the destination moved noticeably, so chasing doesn't run A* every tick. */
const REPATH_DISTANCE = 120;

export function moveToward(game: Game, u: Unit, dest: Vec2) {
  if (u.pathGoal && u.path.length > 0 && dist(u.pathGoal, dest) < REPATH_DISTANCE) return;
  if (dist(u.pos, dest) < 15) {
    stopMoving(u);
    return;
  }
  u.path = game.nav.findPath(u.pos, dest);
  u.pathGoal = { x: dest.x, y: dest.y };
}

/** Straight-line move (lane minions: their lanes are always walkable). */
export function moveDirect(u: Unit, dest: Vec2) {
  u.path = [{ x: dest.x, y: dest.y }];
  u.pathGoal = null;
}

export function stopMoving(u: Unit) {
  u.path.length = 0;
  u.pathGoal = null;
}

const MOBILE = new Set<Unit['kind']>(['champion', 'minion', 'monster']);

export function updateMovement(game: Game, dt: number) {
  for (const u of game.state.units.values()) {
    if (!u.alive || u.path.length === 0 || u.moveSpeed <= 0) continue;
    let budget = u.moveSpeed * dt;
    while (budget > 0 && u.path.length > 0) {
      const wp = u.path[0];
      const d = dist(u.pos, wp);
      if (d <= budget) {
        u.pos.x = wp.x;
        u.pos.y = wp.y;
        u.path.shift();
        budget -= d;
      } else {
        const k = budget / d;
        u.pos.x += (wp.x - u.pos.x) * k;
        u.pos.y += (wp.y - u.pos.y) * k;
        budget = 0;
      }
    }
  }
  separate(game);
}

/** Soft collision between mobile units so waves and champions don't stack on one point. */
function separate(game: Game) {
  for (const a of game.state.units.values()) {
    if (!a.alive || !MOBILE.has(a.kind)) continue;
    for (const b of game.queryUnits(a.pos, a.radius + 70)) {
      if (b.id <= a.id || !b.alive || !MOBILE.has(b.kind)) continue;
      const d = dist(a.pos, b.pos);
      const overlap = a.radius + b.radius - d;
      if (overlap <= 0) continue;
      const nx = d > 0.01 ? (a.pos.x - b.pos.x) / d : 1;
      const ny = d > 0.01 ? (a.pos.y - b.pos.y) / d : 0;
      const push = overlap * 0.25;
      nudge(game, a, nx * push, ny * push);
      nudge(game, b, -nx * push, -ny * push);
    }
  }
}

function nudge(game: Game, u: Unit, dx: number, dy: number) {
  const next = { x: u.pos.x + dx, y: u.pos.y + dy };
  if (game.nav.isWalkable(next)) {
    u.pos.x = next.x;
    u.pos.y = next.y;
  }
}
