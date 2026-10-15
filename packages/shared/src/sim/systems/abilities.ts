import { CHAMPIONS_BY_ID } from '../../data/champions';
import { RULES } from '../../data/rules';
import { dist } from '../../math';
import type { Game } from '../Game';
import { canAttack, isStructure } from '../queries';
import type { ChampionUnit, Unit } from '../types';
import { dealDamage } from './combat';

/** AoE victims. Champions are only hit when we are already fighting one (order or retaliation). */
function hostileNear(game: Game, c: ChampionUnit, center: { x: number; y: number }, radius: number, hitChampions: boolean): Unit[] {
  return game
    .queryUnits(center, radius + 150)
    .filter(
      (u) =>
        !isStructure(u) &&
        (hitChampions || u.kind !== 'champion') &&
        canAttack(game, c, u) &&
        dist(u.pos, center) <= radius + u.radius,
    );
}

/** Single auto-cast ability per champion, used as soon as it has something useful to do. */
export function tryCastAbility(game: Game, c: ChampionUnit) {
  if (c.abilityCd > 0) return;
  const ab = CHAMPIONS_BY_ID[c.defId].ability;
  const time = game.state.time;
  const amount = ab.base + ab.perLevel * (c.level - 1) + ab.adRatio * c.ad + ab.apRatio * c.ap;
  const target = c.targetId !== null ? game.get(c.targetId) : undefined;
  const fightingUnit = target && !isStructure(target) && canAttack(game, c, target) ? target : undefined;
  let cast = false;

  switch (ab.kind) {
    case 'nuke': {
      if (fightingUnit && dist(c.pos, fightingUnit.pos) <= ab.range + fightingUnit.radius) {
        dealDamage(game, c, fightingUnit, amount, ab.damageType);
        game.emit({ type: 'ability', from: c.id, to: fightingUnit.id, pos: { ...fightingUnit.pos }, radius: 0, kind: ab.kind });
        cast = true;
      }
      break;
    }
    case 'aoe': {
      const radius = ab.radius ?? 300;
      const center =
        ab.origin === 'target'
          ? fightingUnit && dist(c.pos, fightingUnit.pos) <= ab.range
            ? fightingUnit.pos
            : null
          : fightingUnit
            ? c.pos
            : null;
      if (!center) break;
      const hits = hostileNear(game, c, center, radius, fightingUnit?.kind === 'champion');
      if (hits.length === 0) break;
      const at = { ...center };
      for (const u of hits) dealDamage(game, c, u, amount, ab.damageType);
      game.emit({ type: 'ability', from: c.id, to: null, pos: at, radius, kind: ab.kind });
      cast = true;
      break;
    }
    case 'heal': {
      let best: ChampionUnit | null = null;
      for (const ally of game.state.champions) {
        if (ally.team !== c.team || !ally.alive || dist(ally.pos, c.pos) > ab.range) continue;
        const ratio = ally.hp / ally.maxHp;
        if (ratio < 0.7 && (!best || ratio < best.hp / best.maxHp)) best = ally;
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + amount);
        game.emit({ type: 'ability', from: c.id, to: best.id, pos: { ...best.pos }, radius: 0, kind: ab.kind });
        cast = true;
      }
      break;
    }
    case 'shield': {
      if (time - c.lastDamagedAt < 1) {
        c.shield = amount;
        c.shieldUntil = time + (ab.duration ?? 3);
        game.emit({ type: 'ability', from: c.id, to: c.id, pos: { ...c.pos }, radius: 0, kind: ab.kind });
        cast = true;
      }
      break;
    }
  }

  if (cast) {
    const blueBuff = c.buffs.blue > time ? 0.8 : 1;
    c.abilityCd = ab.cooldown * (100 / (100 + c.abilityHaste)) * blueBuff;
  }
}

/** Junglers automatically smite a monster they are fighting once it is in execute range. */
export function trySmite(game: Game, c: ChampionUnit) {
  if (c.role !== 'jungle' || c.smiteCharges < 1 || c.smiteLockout > 0 || c.targetId === null) return;
  const target = game.get(c.targetId);
  if (!target || target.kind !== 'monster' || !target.alive || target.hp > RULES.smiteDamage) return;
  if (dist(c.pos, target.pos) > 500 + c.radius + target.radius) return;
  dealDamage(game, c, target, RULES.smiteDamage, 'true');
  if (c.smiteCharges === RULES.smiteMaxCharges) c.smiteRecharge = RULES.smiteRecharge;
  c.smiteCharges--;
  c.smiteLockout = RULES.smiteLockout;
  game.emit({ type: 'smite', championId: c.id, targetId: target.id });
}
