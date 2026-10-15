import { FOUNTAINS } from '../../data/map';
import { MONSTER_STATS } from '../../data/monsters';
import { RULES } from '../../data/rules';
import { dist, type Vec2 } from '../../math';
import { enemyOf, type Lane } from '../../types';
import { createWard } from '../factory';
import type { Game } from '../Game';
import { laneTrack } from '../LaneTrack';
import { canAttack, inAttackRange, isStructure, isTargetable, resistFactor } from '../queries';
import type { CampState, ChampionUnit, JungleScope, StructureUnit, Unit, WardUnit } from '../types';
import { moveToward, stopMoving } from './movement';

/** Leaves a temporary order (attack, ward, recall...) and resumes the lane / jungle job, if any. */
export function finishOrder(c: ChampionUnit) {
  c.order = c.standingOrder ?? { type: 'idle' };
  c.targetId = null;
  stopMoving(c);
}

/**
 * Back from the fountain (recall / respawn): with "retour en lane", resume the usual job.
 * With farm auto OFF the champion only acts on orders, so only an explicit job is resumed.
 */
export function returnToJob(c: ChampionUnit) {
  if (!c.standingOrder && c.autoReturn && c.autoFarm && c.homeOrder.type !== 'idle') c.standingOrder = c.homeOrder;
  finishOrder(c);
}

function engage(game: Game, c: ChampionUnit, target: Unit) {
  c.targetId = target.id;
  if (inAttackRange(c, target)) stopMoving(c);
  else moveToward(game, c, target.pos);
}

function goTo(game: Game, c: ChampionUnit, dest: Vec2, tolerance: number): boolean {
  if (dist(c.pos, dest) <= tolerance) {
    stopMoving(c);
    return true;
  }
  moveToward(game, c, dest);
  return false;
}

export function runBehavior(game: Game, c: ChampionUnit) {
  const order = c.order;
  switch (order.type) {
    case 'idle':
      return holdBehavior(game, c);
    case 'move':
      return moveBehavior(game, c, order.pos);
    case 'attackMove':
      return attackMoveBehavior(game, c, order.pos);
    case 'attack':
      return attackBehavior(game, c, order.targetId);
    case 'lane':
      return laneBehavior(game, c, order.lane);
    case 'jungle':
      return jungleBehavior(game, c, order.scope);
    case 'ward':
      return wardBehavior(game, c, order.pos);
    case 'follow':
      return followBehavior(game, c, order.targetId);
    case 'recall':
      return recallBehavior(game, c);
  }
}

/** Automatic targeting never picks an enemy champion: champion fights only start from player orders. */
const autoTargetable = (game: Game, c: ChampionUnit, u: Unit) => u.kind !== 'champion' && canAttack(game, c, u);

/** The enemy champion that just hit us, if any: answering it is self-defense, not starting a fight. */
function retaliationTarget(game: Game, c: ChampionUnit): Unit | null {
  if (c.lastDamagedBy === null || game.state.time - c.lastDamagedAt > RULES.championRetaliationWindow) return null;
  const attacker = game.get(c.lastDamagedBy);
  if (attacker?.kind !== 'champion' || !canAttack(game, c, attacker)) return null;
  return dist(c.pos, attacker.pos) <= c.range + 400 ? attacker : null;
}

/** Idle: fight back against anything already in attack range, never chase. */
function holdBehavior(game: Game, c: ChampionUnit) {
  const inRange =
    retaliationTarget(game, c) ??
    game.queryUnits(c.pos, c.range + c.radius + 300).find((u) => autoTargetable(game, c, u) && inAttackRange(c, u));
  stopMoving(c);
  c.targetId = inRange?.id ?? null;
  c.activity = inRange ? 'fighting' : 'idle';
}

function moveBehavior(game: Game, c: ChampionUnit, pos: Vec2) {
  c.targetId = null;
  c.activity = 'moving';
  if (goTo(game, c, pos, 30)) finishOrder(c);
  else if (c.path.length === 0) finishOrder(c); // unreachable
}

function attackMoveBehavior(game: Game, c: ChampionUnit, pos: Vec2) {
  const score = (u: Unit) => (u.kind === 'champion' ? 0 : u.kind === 'minion' ? 1 : u.kind === 'monster' ? 2 : 3);
  const enemies = game
    .queryUnits(c.pos, 800)
    .filter((u) => canAttack(game, c, u))
    .sort((a, b) => score(a) - score(b) || dist(c.pos, a.pos) - dist(c.pos, b.pos));
  if (enemies[0]) {
    engage(game, c, enemies[0]);
    c.activity = 'fighting';
    return;
  }
  c.targetId = null;
  c.activity = 'moving';
  if (goTo(game, c, pos, 30)) {
    c.order = { type: 'idle' };
  }
}

function attackBehavior(game: Game, c: ChampionUnit, targetId: number) {
  const target = game.get(targetId);
  if (!target || !target.alive) return finishOrder(c);
  if (!isTargetable(game, target)) {
    game.emit({ type: 'orderFailed', championId: c.id, reason: 'notTargetable' });
    return finishOrder(c);
  }
  c.activity = isStructure(target) ? 'sieging' : 'fighting';
  if (!canAttack(game, c, target)) {
    // A champion that vanished in the fog is lost: chasing it would reveal its position.
    if (target.kind === 'champion') return finishOrder(c);
    // Static target in the fog (e.g. a jungle camp): walk to where it is.
    c.targetId = null;
    moveToward(game, c, target.pos);
    return;
  }
  engage(game, c, target);
}

function laneBehavior(game: Game, c: ChampionUnit, lane: Lane) {
  const track = laneTrack(c.team, lane);
  const enemyTeam = enemyOf(c.team);
  const enemyTurrets = game.state.structures.filter(
    (s) => s.alive && s.kind === 'turret' && s.team === enemyTeam && (s.lane === lane || s.lane === null),
  );
  const allyMinions: Unit[] = [];
  for (const u of game.state.units.values()) {
    if (u.kind === 'minion' && u.alive && u.team === c.team && u.lane === lane) allyMinions.push(u);
  }

  // 1. Never tank a turret: back off out of its range.
  const threat = enemyTurrets.find((t) => t.targetId === c.id);
  if (threat) {
    const s = track.project(threat.pos).s;
    moveToward(game, c, track.pointAt(s - RULES.turretRange - 350));
    c.targetId = null;
    c.activity = 'retreating';
    return;
  }

  // A turret is only safe to stand under while enough of our minions are soaking its shots.
  const tankers = (t: StructureUnit) =>
    allyMinions.filter((m) => dist(m.pos, t.pos) <= RULES.turretRange + m.radius).length;
  const isTanked = (t: StructureUnit) => tankers(t) >= 2;
  const canDive = (t: StructureUnit) => tankers(t) >= 3 && c.hp > c.maxHp * 0.4;
  const unsafe = (p: Vec2) =>
    enemyTurrets.some((t) => dist(p, t.pos) <= RULES.turretRange + c.radius + 80 && !isTanked(t));

  const retaliate = retaliationTarget(game, c);
  if (retaliate) {
    engage(game, c, retaliate);
    c.activity = 'fighting';
    return;
  }

  // 2. Farm / siege what is around us. Without our wave nearby, only answer what is already in range:
  // enemy minions would focus us (and they outrun most champions).
  const waveNear = allyMinions.some((m) => dist(m.pos, c.pos) < 900);
  const scanRadius = waveNear ? c.range + 650 : c.range + c.radius + 100;
  let best: Unit | null = null;
  let bestScore = -Infinity;
  for (const u of game.queryUnits(c.pos, scanRadius)) {
    if (u.kind === 'monster' || !autoTargetable(game, c, u)) continue;
    let score: number;
    if (isStructure(u)) {
      if (u.kind === 'turret' ? !canDive(u) : unsafe(u.pos)) continue;
      score = 10;
    } else {
      if (unsafe(u.pos)) continue;
      const lastHit = u.hp <= c.ad * resistFactor(u.armor);
      score = lastHit ? 100 : 50 - (u.hp / u.maxHp) * 20;
    }
    score -= dist(c.pos, u.pos) / 100;
    if (score > bestScore) {
      best = u;
      bestScore = score;
    }
  }
  if (best) {
    engage(game, c, best);
    c.activity = isStructure(best) ? 'sieging' : 'farming';
    return;
  }

  // 3. Position just behind our wave, or at our outermost turret when there is no wave.
  let front = -1;
  for (const m of allyMinions) front = Math.max(front, track.project(m.pos).s);
  let desired: number;
  if (front >= 0) {
    desired = front - 200;
  } else {
    const own = game.state.structures
      .filter((s) => s.alive && s.kind === 'turret' && s.team === c.team && s.lane === lane)
      .map((s) => track.project(s.pos).s);
    desired = own.length > 0 ? Math.max(...own) - 250 : 600;
  }
  for (const t of enemyTurrets) {
    const p = track.project(t.pos);
    if (p.offset < 1500 && !isTanked(t)) desired = Math.min(desired, p.s - RULES.turretRange - 200);
  }

  c.targetId = null;
  const arrived = goTo(game, c, track.pointAt(desired), 150);
  c.activity = front >= 0 ? (arrived ? 'farming' : 'pushing') : arrived ? 'waiting' : 'moving';
}

function campInScope(camp: CampState, scope: JungleScope, team: ChampionUnit['team']): boolean {
  if (MONSTER_STATS[camp.def.kind].epic) return false;
  if (scope === 'all' || camp.def.owner === 'neutral') return true;
  return scope === 'own' ? camp.def.owner === team : camp.def.owner === enemyOf(team);
}

function jungleBehavior(game: Game, c: ChampionUnit, scope: JungleScope) {
  const retaliate = retaliationTarget(game, c);
  if (retaliate) {
    c.activity = 'fighting';
    return engage(game, c, retaliate);
  }
  c.activity = 'jungling';
  const current = c.targetId !== null ? game.get(c.targetId) : undefined;
  if (current?.kind === 'monster' && canAttack(game, c, current)) return engage(game, c, current);

  const camps = game.state.camps.filter((camp) => campInScope(camp, scope, c.team));
  let nearest: CampState | null = null;
  for (const camp of camps) {
    if (camp.unitId === null) continue;
    if (!nearest || dist(c.pos, camp.def.pos) < dist(c.pos, nearest.def.pos)) nearest = camp;
  }

  if (nearest) {
    const monster = game.get(nearest.unitId!);
    if (monster && dist(c.pos, nearest.def.pos) < 700 && canAttack(game, c, monster)) return engage(game, c, monster);
    c.targetId = null;
    moveToward(game, c, nearest.def.pos);
    return;
  }

  // Everything is down: wait at the next camp to respawn.
  const next = camps
    .filter((camp) => camp.nextSpawnAt !== null)
    .sort((a, b) => a.nextSpawnAt! - b.nextSpawnAt!)[0];
  c.targetId = null;
  if (next) goTo(game, c, next.def.pos, 300);
  c.activity = 'waiting';
}

function wardBehavior(game: Game, c: ChampionUnit, pos: Vec2) {
  if (c.wardCharges < 1) {
    game.emit({ type: 'orderFailed', championId: c.id, reason: 'noWardCharge' });
    return finishOrder(c);
  }
  c.targetId = null;
  c.activity = 'warding';
  if (!goTo(game, c, pos, RULES.wardPlaceRange)) return;

  const spot = game.nav.nearestWalkable(pos);
  const time = game.state.time;
  const mine: WardUnit[] = [];
  for (const u of game.state.units.values()) {
    if (u.kind === 'ward' && u.alive && u.ownerId === c.id) mine.push(u);
  }
  if (mine.length >= RULES.wardMaxActivePerChampion) {
    mine.sort((a, b) => a.expiresAt - b.expiresAt)[0].alive = false;
  }
  game.add(createWard(game.allocateId(), c, spot, time));
  c.wardCharges--;
  c.stats.wardsPlaced++;
  game.emit({ type: 'wardPlaced', championId: c.id, pos: spot });
  finishOrder(c);
}

/** Escort an ally: stay close, and help with whatever it is attacking (the order allows champion fights). */
function followBehavior(game: Game, c: ChampionUnit, allyId: number) {
  const ally = game.champion(allyId);
  if (!ally || !ally.alive || ally.team !== c.team || ally.id === c.id) return finishOrder(c);
  c.activity = 'escorting';
  const allyTarget = ally.targetId !== null ? game.get(ally.targetId) : undefined;
  const assist = allyTarget && canAttack(game, c, allyTarget) ? allyTarget : retaliationTarget(game, c);
  if (assist) return engage(game, c, assist);
  c.targetId = null;
  if (dist(c.pos, ally.pos) > RULES.escortDistance) moveToward(game, c, ally.pos);
  else stopMoving(c);
}

export function isInFountain(c: ChampionUnit): boolean {
  return dist(c.pos, FOUNTAINS[c.team]) <= RULES.fountainRadius;
}

function recallBehavior(game: Game, c: ChampionUnit) {
  if (isInFountain(c)) return finishOrder(c);
  if (c.recallTimer !== null) return;
  c.targetId = null;
  if (game.state.time - c.lastDamagedAt < 2) {
    // Still under fire: walk home until it is safe to channel.
    moveToward(game, c, FOUNTAINS[c.team]);
    c.activity = 'retreating';
    return;
  }
  stopMoving(c);
  c.recallTimer = c.hasBaron ? RULES.baronRecallDuration : RULES.recallDuration;
  c.activity = 'recalling';
  game.emit({ type: 'recallStarted', championId: c.id });
}

