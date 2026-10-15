import { FOUNTAINS } from '../../data/map';
import { RULES, wardRechargeTime } from '../../data/rules';
import type { Game } from '../Game';
import { isStructure } from '../queries';
import type { ChampionUnit, Order } from '../types';
import { tryCastAbility, trySmite } from './abilities';
import { isInFountain, returnToJob, runBehavior } from './behaviors';
import { stopMoving } from './movement';
import { addGold, autoBuy, recomputeChampionStats } from './progression';

export function fountainSpot(c: ChampionUnit, index: number) {
  const f = FOUNTAINS[c.team];
  const angle = (index / 5) * Math.PI * 0.5;
  const dir = c.team === 'blue' ? 1 : -1;
  return { x: f.x + dir * Math.cos(angle) * 250, y: f.y + dir * Math.sin(angle) * 250 };
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

    if (c.autoRetreat && !inFountain && c.order.type !== 'recall' && c.hp < c.maxHp * 0.25) {
      c.order = { type: 'recall' };
      game.emit({ type: 'autoRetreat', championId: c.id });
    }

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

/** "Farm auto": a champion idling with nothing to do goes back to its usual job after a delay. */
function checkAutoFarm(game: Game, c: ChampionUnit) {
  const idle = c.order.type === 'idle' && c.activity === 'idle';
  if (!idle || !c.autoFarm || c.homeOrder.type === 'idle') {
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
