import { RULES } from '../../data/rules';
import { clamp, dist } from '../../math';
import type { Game } from '../Game';
import { canAttack, isStructure } from '../queries';
import type { StructureUnit, Unit } from '../types';

/** LoL turret priority: siege/super > melee > caster > champions. */
function turretPriority(u: Unit): number {
  if (u.kind === 'minion') {
    if (u.minionType === 'siege' || u.minionType === 'super') return 1;
    if (u.minionType === 'melee') return 2;
    return 3;
  }
  if (u.kind === 'champion') return 4;
  return 9;
}

const inTurretRange = (t: StructureUnit, u: Unit) => dist(t.pos, u.pos) <= t.range + u.radius;

function pickTarget(game: Game, turret: StructureUnit, current: Unit | undefined): Unit | undefined {
  const time = game.state.time;
  let best: Unit | undefined;
  let bestPrio = Infinity;
  let bestDist = Infinity;

  for (const u of game.queryUnits(turret.pos, turret.range + 100)) {
    if (u.kind === 'monster' || isStructure(u) || !inTurretRange(turret, u) || !canAttack(game, turret, u)) continue;
    // A champion that just hit an allied champion under the turret gets aggro immediately.
    if (u.kind === 'champion' && time - u.aggressionAt < 2) return u;
    const p = turretPriority(u);
    const d = dist(turret.pos, u.pos);
    if (p < bestPrio || (p === bestPrio && d < bestDist)) {
      best = u;
      bestPrio = p;
      bestDist = d;
    }
  }
  return current ?? best;
}

export function updateStructures(game: Game, dt: number) {
  const time = game.state.time;
  for (const s of game.state.structures) {
    if (!s.alive) {
      if (s.kind === 'inhibitor' && s.respawnTimer > 0) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.alive = true;
          s.hp = s.maxHp;
          game.emit({ type: 'inhibitorRespawned', structureId: s.structureId, team: s.team });
        }
      }
      continue;
    }
    if (s.kind !== 'turret') continue;

    const rampEnd = s.tier === 'outer' ? RULES.outerTurretRampEnd : RULES.turretRampEnd;
    s.ad = s.adMin + (s.adMax - s.adMin) * clamp(time / rampEnd, 0, 1);
    let current = s.targetId !== null ? game.get(s.targetId) : undefined;
    if (current && (!canAttack(game, s, current) || !inTurretRange(s, current))) current = undefined;
    s.targetId = pickTarget(game, s, current)?.id ?? null;
  }
}
