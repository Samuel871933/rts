import type { CampKind } from './map';

export type MonsterBuff = 'blue' | 'red' | 'dragon' | 'baron';

export interface MonsterStats {
  name: string;
  hp: number;
  ad: number;
  attackSpeed: number;
  range: number;
  armor: number;
  mr: number;
  radius: number;
  gold: number;
  xp: number;
  firstSpawn: number;
  respawn: number;
  /** How far from its camp the monster may step while fighting (0 = never moves, like Baron). */
  leash: number;
  epic: boolean;
  /** Scuttle crab doesn't fight back. */
  passive: boolean;
  buff: MonsterBuff | null;
}

const camp = (s: Partial<MonsterStats> & Pick<MonsterStats, 'name' | 'hp' | 'gold' | 'xp'>): MonsterStats => ({
  ad: 0,
  attackSpeed: 0.6,
  range: 150,
  armor: 20,
  mr: 20,
  radius: 90,
  firstSpawn: 90,
  respawn: 135,
  leash: 450,
  epic: false,
  passive: false,
  buff: null,
  ...s,
});

/**
 * One merged monster per camp (macro scale): small monsters are folded into the camp's HP.
 * Spawn timings from the LoL wiki, patch V26.01 (buff camps, wolves, raptors 0:55; gromp, krugs 1:07;
 * scuttle 2:55; dragon 5:00; baron 20:00).
 */
export const MONSTER_STATS: Record<CampKind, MonsterStats> = {
  blueSentinel: camp({ name: 'Sentinelle bleue', hp: 2300, ad: 66, armor: 42, mr: 42, attackSpeed: 0.493, gold: 90, xp: 95, respawn: 300, radius: 110, firstSpawn: 55, buff: 'blue' }),
  redBrambleback: camp({ name: 'Ronceboeuf rouge', hp: 2300, ad: 66, armor: 42, mr: 42, attackSpeed: 0.493, gold: 90, xp: 95, respawn: 300, radius: 110, firstSpawn: 55, buff: 'red' }),
  gromp: camp({ name: 'Gromp', hp: 2050, ad: 70, armor: 42, attackSpeed: 0.425, range: 150, gold: 80, xp: 120, firstSpawn: 67 }),
  wolves: camp({ name: 'Loups', hp: 2860, ad: 55, attackSpeed: 0.625, gold: 85, xp: 80, firstSpawn: 55 }),
  raptors: camp({ name: 'Raptors', hp: 3700, ad: 45, attackSpeed: 0.667, range: 300, gold: 75, xp: 70, firstSpawn: 55 }),
  krugs: camp({ name: 'Krugs', hp: 2360, ad: 70, attackSpeed: 0.6, gold: 109, xp: 121, firstSpawn: 67 }),
  scuttle: camp({ name: 'Carapateur', hp: 1007, gold: 55, xp: 100, firstSpawn: 175, respawn: 150, passive: true, radius: 80 }),
  dragon: camp({
    name: 'Dragon', hp: 5106, ad: 70, attackSpeed: 0.5, range: 500, armor: 65.6, mr: 47.8, radius: 200,
    gold: 75, xp: 300, firstSpawn: 300, respawn: 300, leash: 400, epic: true, buff: 'dragon',
  }),
  baron: camp({
    name: 'Nashor', hp: 17792, ad: 350, attackSpeed: 0.625, range: 955, armor: 104, mr: 67, radius: 240,
    gold: 150, xp: 650, firstSpawn: 20 * 60, respawn: 6 * 60, leash: 0, epic: true, buff: 'baron',
  }),
};
