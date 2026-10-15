import { RULES } from '../../data/rules';
import { dist } from '../../math';
import type { Game } from '../Game';
import { laneTrack } from '../LaneTrack';
import { canAttack, inAttackRange, isStructure } from '../queries';
import type { MinionUnit, Unit } from '../types';
import { moveDirect, stopMoving } from './movement';

const RETARGET_INTERVAL = 0.5;
/** A minion walking its lane with nothing to fight looks around this often (not every tick). */
const IDLE_SCAN_INTERVAL = 0.2;

/** Lower is preferred: minions fight minions first, then champions, then structures. */
function priority(u: Unit): number {
  if (u.kind === 'minion') return 0;
  if (u.kind === 'champion') return 1;
  if (isStructure(u)) return 2;
  return 9;
}

/**
 * LoL minions are bound to their lane: they only fight what stands in it, and never chase
 * farther than a short distance from where they left their path.
 */
function inReachOfLane(m: MinionUnit, u: Unit): boolean {
  if (isStructure(u)) return true; // turrets / inhibitors stand on the lane by design
  if (laneTrack(m.team, m.lane).project(u.pos).offset > RULES.minionLaneCorridor) return false;
  return dist(m.chaseFrom ?? m.pos, u.pos) <= RULES.minionChaseRange;
}

function acquire(game: Game, m: MinionUnit): Unit | null {
  let best: Unit | null = null;
  let bestPrio = Infinity;
  let bestDist = Infinity;
  for (const u of game.queryUnits(m.pos, RULES.acquisitionRange + 250)) {
    if (u.kind === 'monster') continue;
    const d = dist(m.pos, u.pos) - u.radius;
    // Cheapest checks first: the lane projection in inReachOfLane is the costly one.
    if (d > RULES.acquisitionRange || !canAttack(game, m, u) || !inReachOfLane(m, u)) continue;
    const p = priority(u);
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
    const valid = target && canAttack(game, m, target) && inReachOfLane(m, target);
    // Lost its target: look again now. Fighting, or walking with nothing around: on a timer.
    const lostTarget = target !== undefined && !valid;
    if (lostTarget || time >= m.retargetAt) {
      const next = acquire(game, m);
      // Keep the current target unless something strictly better showed up.
      if (!valid || (next && priority(next) < priority(target!))) target = next ?? undefined;
      m.retargetAt = time + (target ? RETARGET_INTERVAL : IDLE_SCAN_INTERVAL);
    } else if (!valid) {
      target = undefined;
    }
    m.targetId = target?.id ?? null;

    if (target) {
      m.chaseFrom ??= { ...m.pos };
      if (inAttackRange(m, target)) stopMoving(m);
      else moveDirect(m, target.pos);
      continue;
    }

    // Nothing to fight: back on the lane path, toward the next waypoint ahead.
    m.chaseFrom = null;
    const track = laneTrack(m.team, m.lane);
    const { s: progress, offset } = track.project(m.pos);
    let wp = m.waypoint;
    while (wp < track.points.length - 1 && track.cumulative[wp] <= progress + 80) wp++;
    m.waypoint = wp;
    // Drifted aside while fighting: rejoin the lane first rather than cutting corners.
    const goal = offset > 150 ? track.pointAt(progress + 150) : track.points[wp];
    if (dist(m.pos, goal) > 30) moveDirect(m, goal);
    else stopMoving(m);
  }
}
