import { RULES } from '../data/rules';
import { dist, type Vec2 } from '../math';
import { LANES, type Team } from '../types';
import type { Game } from './Game';
import type { ChampionUnit, StructureUnit, Unit } from './types';

export const isStructure = (u: Unit): u is StructureUnit =>
  u.kind === 'turret' || u.kind === 'inhibitor' || u.kind === 'nexus';

export const isEnemy = (a: Unit, b: Unit): boolean => a.team !== b.team;

/** Structures are invulnerable while the structures protecting them still stand. */
export function isTargetable(game: Game, u: Unit): boolean {
  if (!u.alive || u.kind === 'ward') return false;
  if (!isStructure(u) || u.protectedBy.length === 0) return true;
  const down = (id: number) => !game.get(id)?.alive;
  return u.protectMode === 'all' ? u.protectedBy.every(down) : u.protectedBy.some(down);
}

export function canAttack(game: Game, attacker: Unit, target: Unit): boolean {
  if (!isEnemy(attacker, target) || !isTargetable(game, target)) return false;
  if (attacker.team === 'neutral') return true;
  return target.visible[attacker.team];
}

export const inAttackRange = (a: Unit, t: Unit): boolean => dist(a.pos, t.pos) <= a.range + a.radius + t.radius;

export function resistFactor(resist: number): number {
  return resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist);
}

export function aliveChampionsNear(game: Game, team: Team, pos: Vec2, radius: number): ChampionUnit[] {
  return game.state.champions.filter((c) => c.team === team && c.alive && dist(c.pos, pos) <= radius);
}

/** Allied minions standing in an enemy turret's range: they soak its shots. */
export function minionsUnderTurret(game: Game, team: Team, turret: StructureUnit): number {
  let n = 0;
  // Lane turrets only see their lane's wave; nexus turrets (no lane) can see any of them.
  for (const lane of turret.lane ? [turret.lane] : LANES) {
    for (const u of game.minionsOf(team, lane)) {
      if (u.alive && dist(u.pos, turret.pos) <= RULES.turretRange + u.radius) n++;
    }
  }
  return n;
}
