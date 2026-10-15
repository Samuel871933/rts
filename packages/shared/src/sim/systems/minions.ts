import { RULES } from '../../data/rules';
import { dist } from '../../math';
import type { Game } from '../Game';
import { laneTrack } from '../LaneTrack';
import { canAttack, inAttackRange, isStructure } from '../queries';
import type { MinionUnit, Unit } from '../types';
import { moveDirect, stopMoving } from './movement';

const LEASH = 900;
const RETARGET_INTERVAL = 0.5;

/** Lower is preferred: minions fight minions first, then champions, then structures. */
function priority(u: Unit): number {
  if (u.kind === 'minion') return 0;
  if (u.kind === 'champion') return 1;
  if (isStructure(u)) return 2;
  return 9;
}

function acquire(game: Game, m: MinionUnit): Unit | null {
  let best: Unit | null = null;
  let bestPrio = Infinity;
  let bestDist = Infinity;
  for (const u of game.queryUnits(m.pos, RULES.acquisitionRange + 250)) {
    if (u.kind === 'monster' || !canAttack(game, m, u)) continue;
    const p = priority(u);
    const d = dist(m.pos, u.pos) - u.radius;
    if (d > RULES.acquisitionRange) continue;
    if (p < bestPrio || (p === bestPrio && d < bestDist)) {
      best = u;
      bestPrio = p;
      bestDist = d;
    }
  }
  return best;
}

export function updateMinions(game: Game) {
  const time = game.state.time;
  for (const m of game.state.units.values()) {
    if (m.kind !== 'minion' || !m.alive) continue;

    let target = m.targetId !== null ? game.get(m.targetId) : undefined;
    const valid = target && canAttack(game, m, target) && dist(m.pos, target.pos) <= LEASH;
    if (!valid || time >= m.retargetAt) {
      const next = acquire(game, m);
      // Keep the current target unless something strictly better showed up.
      if (!valid || (next && priority(next) < priority(target!))) target = next ?? undefined;
      m.retargetAt = time + RETARGET_INTERVAL;
    }
    m.targetId = target?.id ?? null;

    if (target) {
      if (inAttackRange(m, target)) stopMoving(m);
      else moveDirect(m, target.pos);
      continue;
    }

    // Walk the lane toward the next waypoint ahead of us.
    const track = laneTrack(m.team, m.lane);
    const progress = track.project(m.pos).s;
    let wp = m.waypoint;
    while (wp < track.points.length - 1 && track.cumulative[wp] <= progress + 80) wp++;
    m.waypoint = wp;
    if (dist(m.pos, track.points[wp]) > 30) moveDirect(m, track.points[wp]);
    else stopMoving(m);
  }
}
