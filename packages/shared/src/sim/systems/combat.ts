import { MINION_STATS } from '../../data/minions';
import { RULES, championKillBounty, respawnTime } from '../../data/rules';
import { enemyOf } from '../../types';
import type { Game } from '../Game';
import { canAttack, inAttackRange, isStructure, resistFactor } from '../queries';
import type { ChampionUnit, DamageType, MinionUnit, StructureUnit, Unit } from '../types';
import { onMonsterKilled } from './camps';
import { stopMoving } from './movement';
import { addGold, shareXp } from './progression';

export function dealDamage(game: Game, source: Unit | null, target: Unit, amount: number, type: DamageType): number {
  if (!target.alive || amount <= 0) return 0;
  const time = game.state.time;

  let dmg = amount;
  if (type === 'physical') dmg *= resistFactor(target.armor);
  else if (type === 'magic') dmg *= resistFactor(target.mr);

  if (source?.kind === 'champion') {
    const stacks = Math.min(game.state.teams[source.team].dragons, RULES.dragonMaxStacks);
    dmg *= 1 + stacks * RULES.dragonDamagePerStack;
  }
  if (source?.kind === 'monster' && target.kind === 'champion' && target.role === 'jungle') {
    dmg *= RULES.jungleCompanionDamageTaken;
  }
  if (target.kind === 'champion' && target.shield > 0 && target.shieldUntil > time) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }

  target.hp -= dmg;
  target.lastDamagedAt = time;
  target.lastDamagedBy = source?.id ?? null;

  if (source?.kind === 'champion') {
    source.stats.damageDealt += dmg;
    if (target.kind === 'champion') source.aggressionAt = time;
  }
  if (target.kind === 'champion' && target.recallTimer !== null) {
    target.recallTimer = null;
    game.emit({ type: 'recallCancelled', championId: target.id });
  }
  if (target.kind === 'monster' && source && !target.passive && !target.resetting && target.targetId === null) {
    target.targetId = source.id;
  }

  if (target.hp <= 0) killUnit(game, target, source);
  return dmg;
}

function turretShotDamage(game: Game, turret: Unit, target: Unit): { amount: number; type: DamageType } {
  if (target.kind === 'minion') {
    const share =
      target.minionType === 'siege'
        ? RULES.turretVsSiegeMaxHp[(turret as StructureUnit).tier]
        : RULES.turretVsMinionMaxHp[target.minionType];
    return { amount: target.maxHp * share, type: 'true' };
  }
  if (target.kind === 'champion') {
    const ramp = target.turretRamp;
    const time = game.state.time;
    if (time - ramp.lastHit > RULES.turretRampReset) ramp.stacks = 0;
    const bonus = Math.min(ramp.stacks * RULES.turretRampPerShot, RULES.turretRampMax);
    ramp.stacks++;
    ramp.lastHit = time;
    return { amount: turret.ad * (1 + bonus), type: 'physical' };
  }
  return { amount: turret.ad, type: 'physical' };
}

function performAttack(game: Game, attacker: Unit, target: Unit) {
  let { amount, type } =
    attacker.kind === 'turret' ? turretShotDamage(game, attacker, target) : { amount: attacker.ad, type: 'physical' as DamageType };
  let bonusTrue = 0;

  if (attacker.kind === 'minion' && isStructure(target)) {
    amount *= attacker.minionType === 'siege' && target.kind === 'turret' ? RULES.siegeDamageToTurrets : RULES.minionDamageToStructures;
  }
  if (attacker.kind === 'champion') {
    if (target.kind === 'monster' && attacker.role === 'jungle') bonusTrue += RULES.jungleCompanionBonusDamage;
    if (attacker.buffs.red > game.state.time) bonusTrue += 10 + 2 * attacker.level;
  }

  game.emit({ type: 'attack', from: attacker.id, to: target.id, ranged: attacker.range > 250 });
  dealDamage(game, attacker, target, amount, type);
  if (bonusTrue > 0 && target.alive) dealDamage(game, attacker, target, bonusTrue, 'true');
}

/** Units fire at their current target whenever it is in range and their attack is ready. */
export function updateAttacks(game: Game, dt: number) {
  for (const u of game.state.units.values()) {
    if (!u.alive || u.ad <= 0) continue;
    if (u.attackTimer > 0) u.attackTimer -= dt;
    if (u.targetId === null) continue;
    const target = game.get(u.targetId);
    if (!target || !canAttack(game, u, target)) {
      u.targetId = null;
      continue;
    }
    if (u.kind === 'champion' && u.recallTimer !== null) continue;
    if (u.attackTimer <= 0 && inAttackRange(u, target)) {
      performAttack(game, u, target);
      u.attackTimer = 1 / u.attackSpeed;
    }
  }
}

export function killUnit(game: Game, target: Unit, source: Unit | null) {
  target.alive = false;
  target.hp = 0;
  target.targetId = null;
  stopMoving(target);
  game.emit({ type: 'death', unitId: target.id, kind: target.kind, team: target.team, pos: { ...target.pos } });
  const killer = source?.kind === 'champion' ? source : null;

  switch (target.kind) {
    case 'minion':
      onMinionKilled(game, target, killer);
      break;
    case 'monster':
      onMonsterKilled(game, target, killer);
      break;
    case 'champion':
      onChampionKilled(game, target, killer);
      break;
    case 'turret':
    case 'inhibitor':
    case 'nexus':
      onStructureDestroyed(game, target, killer);
      break;
    case 'ward':
      break;
  }
}

function onMinionKilled(game: Game, minion: MinionUnit, killer: ChampionUnit | null) {
  const stats = MINION_STATS[minion.minionType];
  if (killer) {
    addGold(game, killer, minion.bounty);
    killer.stats.cs++;
  }
  shareXp(game, enemyOf(minion.team), minion.pos, stats.xp);
}

function onChampionKilled(game: Game, victim: ChampionUnit, killer: ChampionUnit | null) {
  victim.respawnTimer = respawnTime(victim.level, game.state.time);
  victim.recallTimer = null;
  victim.shield = 0;
  victim.activity = 'dead';
  victim.stats.deaths++;
  const enemyTeam = enemyOf(victim.team);
  game.state.teams[enemyTeam].kills++;
  if (killer) {
    killer.stats.kills++;
    addGold(game, killer, championKillBounty(victim.level) + (game.state.firstBlood ? 0 : RULES.firstBloodBonus));
    game.state.firstBlood = true;
  }
  const killXp = 42 + (victim.level - 1) * 55;
  shareXp(game, enemyTeam, victim.pos, killXp, RULES.championKillXpRadius);
  game.emit({ type: 'championDied', championId: victim.id, killerId: killer?.id ?? null, respawnIn: victim.respawnTimer });
}

function onStructureDestroyed(game: Game, s: StructureUnit, killer: ChampionUnit | null) {
  const winnerTeam = enemyOf(s.team);
  game.state.teams[winnerTeam].structuresDestroyed++;
  if (killer) killer.stats.structures++;
  for (const c of game.state.champions) {
    if (c.team === winnerTeam && s.globalGold > 0) addGold(game, c, s.globalGold);
  }
  if (s.kind === 'inhibitor') s.respawnTimer = RULES.inhibitorRespawn;
  game.emit({ type: 'structureDestroyed', structureId: s.structureId, kind: s.kind, team: s.team, lane: s.lane, tier: s.tier });
  if (s.kind === 'nexus') {
    game.state.winner = winnerTeam;
    game.emit({ type: 'victory', winner: winnerTeam });
  }
}
