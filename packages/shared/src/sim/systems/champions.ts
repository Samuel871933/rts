import { FOUNTAINS } from '../../data/map';
import { RULES, wardRechargeTime } from '../../data/rules';
import type { Game } from '../Game';
import { laneTrack } from '../LaneTrack';
import { dist } from '../../math';
import { isStructure, minionsUnderTurret } from '../queries';
import type { ChampionUnit, Order, StructureUnit } from '../types';
import { tryCastAbility, trySmite } from './abilities';
import { finishOrder, isInFountain, returnToJob, runBehavior } from './behaviors';
import { stopMoving } from './movement';
import { addGold, autoBuy, recomputeChampionStats } from './progression';

/**
 * Spawn spots around the fountain: a quarter circle of radius 250, five evenly spaced points.
 * Written out rather than computed with cos/sin, whose last digit may differ between JS engines
 * (the browser and the server must simulate the exact same game).
 */
const FOUNTAIN_OFFSETS: readonly [number, number][] = [
  [250, 0],
  [237.76412907378838, 77.25424859373685],
  [202.25424859373686, 146.9463130731183],
  [146.9463130731183, 202.25424859373686],
  [77.25424859373686, 237.76412907378838],
];

export function fountainSpot(c: ChampionUnit, index: number) {
  const f = FOUNTAINS[c.team];
  const [ox, oy] = FOUNTAIN_OFFSETS[index % FOUNTAIN_OFFSETS.length];
  const dir = c.team === 'blue' ? 1 : -1;
  return { x: f.x + dir * ox, y: f.y + dir * oy };
}

function respawn(game: Game, c: ChampionUnit) {
  const index = game.state.champions.filter((x) => x.team === c.team).indexOf(c);
  const spot = fountainSpot(c, index);
  c.alive = true;
  c.hp = c.maxHp;
  c.pos = spot;
  c.prevPos = { ...spot };
  returnToJob(c);
  game.emit({ type: 'championRespawned', championId: c.id });
}

function tickTimers(game: Game, c: ChampionUnit, dt: number) {
  const time = game.state.time;
  c.abilityCd = Math.max(0, c.abilityCd - dt);
  c.smiteLockout = Math.max(0, c.smiteLockout - dt);
  if (c.smiteCharges < RULES.smiteMaxCharges) {
    c.smiteRecharge -= dt;
    if (c.smiteRecharge <= 0) {
      c.smiteCharges++;
      c.smiteRecharge = RULES.smiteRecharge;
    }
  }

  if (c.wardCharges < RULES.wardMaxCharges) {
    if (c.wardRecharge <= 0) c.wardRecharge = wardRechargeTime(c.level);
    c.wardRecharge -= dt;
    if (c.wardRecharge <= 0) {
      c.wardCharges++;
      c.wardRecharge = 0;
    }
  }

  if (c.hasBaron && c.buffs.baron <= time) recomputeChampionStats(game, c);
  if (c.shieldUntil <= time) c.shield = 0;
  if (time >= RULES.passiveGoldStart) addGold(game, c, RULES.passiveGoldPerSecond * dt);
}

export function updateChampions(game: Game, dt: number) {
  for (const c of game.state.champions) {
    if (!c.alive) {
      c.respawnTimer -= dt;
      if (c.respawnTimer > 0) {
        tickTimers(game, c, dt);
        continue;
      }
      respawn(game, c);
    }

    tickTimers(game, c, dt);
    c.hp = Math.min(c.maxHp, c.hp + c.hpRegen * dt);

    const inFountain = isInFountain(c);
    if (inFountain) {
      const missing = c.maxHp - c.hp;
      c.hp = Math.min(c.maxHp, c.hp + (c.maxHp * RULES.fountainHealRatio + missing * RULES.fountainMissingHealPerSecond) * dt);
      autoBuy(game, c);
    }

    if (c.recallTimer !== null) {
      c.recallTimer -= dt;
      c.activity = 'recalling';
      if (c.recallTimer <= 0) {
        c.recallTimer = null;
        const spot = fountainSpot(c, 0);
        c.pos = spot;
        c.prevPos = { ...spot };
        returnToJob(c);
        game.emit({ type: 'recallCompleted', championId: c.id });
      }
      continue;
    }

    checkAutoRetreat(game, c, inFountain);
    checkTurretSafety(game, c);

    // Back at the fountain with low HP: heal up before resuming the job (explicit moves still apply).
    const healing = inFountain && c.hp < c.maxHp * 0.9 && c.order.type !== 'move' && c.order.type !== 'attackMove';
    if (healing) {
      stopMoving(c);
      c.targetId = null;
      c.activity = 'shopping';
    } else {
      runBehavior(game, c);
    }
    tryCastAbility(game, c);
    trySmite(game, c);
    checkAutoFarm(game, c);
  }
}

/**
 * "Repli auto": recall once when HP drops under the threshold. It fires on the way down only,
 * so the player can still send a low champion elsewhere (it fires again after healing above it).
 */
function checkAutoRetreat(game: Game, c: ChampionUnit, inFountain: boolean) {
  if (c.hp >= c.maxHp * RULES.autoRetreatHpRatio) {
    c.retreatFired = false;
    return;
  }
  if (c.retreatFired || !c.autoRetreat || inFountain) return;
  c.retreatFired = true;
  if (c.order.type === 'recall') return;
  applyOrder(game, c, { type: 'recall' });
  game.emit({ type: 'autoRetreat', championId: c.id });
}

/** Extra distance beyond the turret's range (plus our radius) counted as "under the turret". */
const TURRET_SAFETY_MARGIN = 60;

/** Fighting orders "sécurité tour" watches: the player's moves, recalls, wards... are left alone. */
const TURRET_SAFETY_ORDERS = new Set<Order['type']>(['attack', 'attackMove']);

/** Enemy turret about to shoot this champion: it targets us, or no allied minion is left under it. */
function threateningTurret(game: Game, c: ChampionUnit): StructureUnit | null {
  const target = c.targetId !== null ? game.get(c.targetId) : undefined;
  for (const t of game.state.structures) {
    if (t.kind !== 'turret' || !t.alive || t.team === c.team) continue;
    const reach = RULES.turretRange + c.radius + TURRET_SAFETY_MARGIN;
    // Only while fighting there: we stand in range, or we're heading for a target in range.
    const inRange = dist(c.pos, t.pos) <= reach;
    const targetInRange = target !== undefined && dist(target.pos, t.pos) <= reach;
    if (!inRange && !targetInRange) continue;
    if (t.targetId === c.id) return t;
    if (minionsUnderTurret(game, c.team, t) === 0) return t;
  }
  return null;
}

/** Out of the turret's range, on our side of it: back down its lane, or toward our fountain. */
function retreatSpot(c: ChampionUnit, turret: StructureUnit) {
  const clearance = RULES.turretRange + c.radius + 250;
  if (turret.lane) {
    const track = laneTrack(c.team, turret.lane);
    return track.pointAt(track.project(turret.pos).s - clearance);
  }
  const home = FOUNTAINS[c.team];
  const d = dist(home, turret.pos);
  return { x: turret.pos.x + ((home.x - turret.pos.x) / d) * clearance, y: turret.pos.y + ((home.y - turret.pos.y) / d) * clearance };
}

/**
 * "Sécurité tour": a champion sieging or fighting under an enemy turret steps out of its range as
 * soon as the turret would shoot it, then resumes its job (a lane job waits for the next wave).
 */
function checkTurretSafety(game: Game, c: ChampionUnit) {
  if (!c.autoTurretSafety || !TURRET_SAFETY_ORDERS.has(c.order.type)) return;
  const turret = threateningTurret(game, c);
  if (!turret) return;
  if (dist(c.pos, turret.pos) > RULES.turretRange + c.radius + TURRET_SAFETY_MARGIN) {
    // Not under it yet: just drop the order rather than walk in.
    finishOrder(c);
    game.emit({ type: 'turretRetreat', championId: c.id });
    return;
  }
  const safe = game.nav.nearestWalkable(retreatSpot(c, turret));
  // A plain move keeps the standing job: once out of range, the champion resumes it.
  c.order = { type: 'move', pos: safe };
  c.targetId = null;
  stopMoving(c);
  game.emit({ type: 'turretRetreat', championId: c.id });
}

/**
 * "Farm auto": a champion left without orders goes back to its usual post after a delay.
 * Hitting what walks into range while waiting doesn't reset the delay. With "retour en lane" OFF,
 * a champion waiting at the base stays there until ordered.
 */
function waitsForAutoFarm(c: ChampionUnit): boolean {
  if (!c.autoFarm || c.homeOrder.type === 'idle' || c.order.type !== 'idle' || c.recallTimer !== null) return false;
  return c.autoReturn || !isInFountain(c);
}

/** Seconds before farm auto sends the champion back to its post, or null if it won't. */
export function autoFarmCountdown(c: ChampionUnit, time: number): number | null {
  if (!c.alive || !waitsForAutoFarm(c) || c.idleSince === null) return null;
  return Math.max(0, RULES.autoFarmDelay - (time - c.idleSince));
}

function checkAutoFarm(game: Game, c: ChampionUnit) {
  if (!waitsForAutoFarm(c)) {
    c.idleSince = null;
    return;
  }
  c.idleSince ??= game.state.time;
  if (game.state.time - c.idleSince >= RULES.autoFarmDelay) {
    c.idleSince = null;
    applyOrder(game, c, c.homeOrder);
  }
}

/**
 * Player orders. Lane / jungle become the champion's standing job; move / hold clear it.
 * Attacking an enemy minion or lane structure also means "farm / push this lane": once the target
 * is dead (even before we reach it) the champion keeps working that lane.
 */
export function applyOrder(game: Game, c: ChampionUnit, order: Order) {
  if (order.type === 'lane' || order.type === 'jungle') {
    c.standingOrder = order;
    c.homeOrder = order;
  } else if (order.type === 'attack') {
    const target = game.get(order.targetId);
    if (target && target.team !== c.team && (target.kind === 'minion' || isStructure(target)) && target.lane) {
      c.standingOrder = { type: 'lane', lane: target.lane };
      c.homeOrder = c.standingOrder;
    }
  }
  else if (order.type === 'move' || order.type === 'attackMove' || order.type === 'idle' || order.type === 'follow') {
    c.standingOrder = null;
  }

  if (!c.alive) {
    if (order.type === 'lane' || order.type === 'jungle' || order.type === 'idle') c.order = order;
    return;
  }
  if (order.type === 'recall' && c.recallTimer !== null) return;
  if (c.recallTimer !== null) {
    c.recallTimer = null;
    game.emit({ type: 'recallCancelled', championId: c.id });
  }
  c.order = order;
  c.targetId = null;
  stopMoving(c);
}
