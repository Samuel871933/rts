import { championIconUrl } from '../constants';
import { ROLES, type ChampionPick, type Role } from '../types';

export type Archetype = 'fighter' | 'tank' | 'mage' | 'marksman' | 'support' | 'assassin';
export type AbilityKind = 'nuke' | 'aoe' | 'heal' | 'shield';

export interface AbilityDef {
  name: string;
  kind: AbilityKind;
  damageType: 'physical' | 'magic';
  base: number;
  perLevel: number;
  adRatio: number;
  apRatio: number;
  cooldown: number;
  range: number;
  /** aoe only: radius, centered on the caster ('self') or on its target ('target'). */
  radius?: number;
  origin?: 'self' | 'target';
  /** shield only: seconds. */
  duration?: number;
  description: string;
}

export interface ChampionStats {
  hp: number;
  hpPerLevel: number;
  hpRegen5: number;
  hpRegen5PerLevel: number;
  ad: number;
  adPerLevel: number;
  armor: number;
  armorPerLevel: number;
  mr: number;
  mrPerLevel: number;
  attackSpeed: number;
  /** % bonus attack speed per level. */
  attackSpeedPerLevel: number;
  range: number;
  moveSpeed: number;
}

export interface ChampionDef {
  id: string;
  name: string;
  title: string;
  archetype: Archetype;
  roles: Role[];
  iconKey: string;
  stats: ChampionStats;
  ability: AbilityDef;
}

/** Base stats from LoL (wiki, patch V26.x). Abilities are a single auto-cast spell, simplified for macro play. */
export const CHAMPIONS: ChampionDef[] = [
  {
    id: 'garen', name: 'Garen', title: 'La Force de Demacia', archetype: 'fighter', roles: ['top'], iconKey: 'Garen',
    stats: { hp: 690, hpPerLevel: 98, hpRegen5: 8, hpRegen5PerLevel: 0.5, ad: 69, adPerLevel: 4.5, armor: 38, armorPerLevel: 4.2, mr: 32, mrPerLevel: 1.55, attackSpeed: 0.625, attackSpeedPerLevel: 3.65, range: 175, moveSpeed: 340 },
    ability: { name: 'Jugement', kind: 'aoe', damageType: 'physical', base: 45, perLevel: 14, adRatio: 0.7, apRatio: 0, cooldown: 9, range: 0, radius: 325, origin: 'self', description: 'Tournoie et frappe les ennemis autour de lui.' },
  },
  {
    id: 'darius', name: 'Darius', title: "La Main de Noxus", archetype: 'fighter', roles: ['top'], iconKey: 'Darius',
    stats: { hp: 652, hpPerLevel: 114, hpRegen5: 10, hpRegen5PerLevel: 0.95, ad: 64, adPerLevel: 5, armor: 37, armorPerLevel: 5.2, mr: 32, mrPerLevel: 2.05, attackSpeed: 0.625, attackSpeedPerLevel: 1, range: 175, moveSpeed: 340 },
    ability: { name: 'Décimation', kind: 'aoe', damageType: 'physical', base: 50, perLevel: 15, adRatio: 1, apRatio: 0, cooldown: 9, range: 0, radius: 425, origin: 'self', description: 'Balaye la zone avec sa hache.' },
  },
  {
    id: 'leesin', name: 'Lee Sin', title: 'Le Moine aveugle', archetype: 'fighter', roles: ['jungle', 'top'], iconKey: 'LeeSin',
    stats: { hp: 645, hpPerLevel: 108, hpRegen5: 7.5, hpRegen5PerLevel: 0.7, ad: 66, adPerLevel: 3.4, armor: 36, armorPerLevel: 4.5, mr: 32, mrPerLevel: 2.05, attackSpeed: 0.651, attackSpeedPerLevel: 3, range: 125, moveSpeed: 345 },
    ability: { name: 'Onde sonore', kind: 'nuke', damageType: 'physical', base: 55, perLevel: 20, adRatio: 1, apRatio: 0, cooldown: 7, range: 1000, description: 'Projette une onde qui frappe la cible.' },
  },
  {
    id: 'amumu', name: 'Amumu', title: 'La Momie triste', archetype: 'tank', roles: ['jungle', 'support'], iconKey: 'Amumu',
    stats: { hp: 685, hpPerLevel: 94, hpRegen5: 9, hpRegen5PerLevel: 0.85, ad: 57, adPerLevel: 3.8, armor: 33, armorPerLevel: 4, mr: 32, mrPerLevel: 2.05, attackSpeed: 0.736, attackSpeedPerLevel: 2.18, range: 125, moveSpeed: 335 },
    ability: { name: 'Désespoir', kind: 'aoe', damageType: 'magic', base: 35, perLevel: 12, adRatio: 0, apRatio: 0.5, cooldown: 4, range: 0, radius: 350, origin: 'self', description: 'Brûle les ennemis proches avec ses larmes.' },
  },
  {
    id: 'ahri', name: 'Ahri', title: 'Le Renard à neuf queues', archetype: 'mage', roles: ['mid'], iconKey: 'Ahri',
    stats: { hp: 590, hpPerLevel: 104, hpRegen5: 2.5, hpRegen5PerLevel: 0.6, ad: 53, adPerLevel: 3, armor: 21, armorPerLevel: 4.2, mr: 30, mrPerLevel: 1.3, attackSpeed: 0.668, attackSpeedPerLevel: 2.2, range: 550, moveSpeed: 330 },
    ability: { name: "Orbe d'illusion", kind: 'aoe', damageType: 'magic', base: 40, perLevel: 18, adRatio: 0, apRatio: 0.45, cooldown: 6, range: 880, radius: 250, origin: 'target', description: 'Lance un orbe qui traverse les ennemis.' },
  },
  {
    id: 'annie', name: 'Annie', title: "L'Enfant des ténèbres", archetype: 'mage', roles: ['mid', 'support'], iconKey: 'Annie',
    stats: { hp: 560, hpPerLevel: 96, hpRegen5: 5.5, hpRegen5PerLevel: 0.55, ad: 50, adPerLevel: 2.65, armor: 23, armorPerLevel: 4, mr: 30, mrPerLevel: 1.3, attackSpeed: 0.61, attackSpeedPerLevel: 1.36, range: 625, moveSpeed: 335 },
    ability: { name: 'Désintégration', kind: 'nuke', damageType: 'magic', base: 80, perLevel: 25, adRatio: 0, apRatio: 0.75, cooldown: 4, range: 625, description: 'Projette une boule de feu sur la cible.' },
  },
  {
    id: 'jinx', name: 'Jinx', title: 'La Gâchette folle', archetype: 'marksman', roles: ['bot'], iconKey: 'Jinx',
    stats: { hp: 630, hpPerLevel: 105, hpRegen5: 3.75, hpRegen5PerLevel: 0.5, ad: 59, adPerLevel: 3.25, armor: 26, armorPerLevel: 4.2, mr: 33, mrPerLevel: 1.1, attackSpeed: 0.625, attackSpeedPerLevel: 1, range: 525, moveSpeed: 325 },
    ability: { name: 'Zap!', kind: 'nuke', damageType: 'physical', base: 10, perLevel: 20, adRatio: 1.4, apRatio: 0, cooldown: 8, range: 1450, description: 'Tire un rayon électrique à longue portée.' },
  },
  {
    id: 'ashe', name: 'Ashe', title: "L'Archère de givre", archetype: 'marksman', roles: ['bot', 'support'], iconKey: 'Ashe',
    stats: { hp: 610, hpPerLevel: 101, hpRegen5: 3.5, hpRegen5PerLevel: 0.55, ad: 59, adPerLevel: 3, armor: 26, armorPerLevel: 4.6, mr: 33, mrPerLevel: 1.1, attackSpeed: 0.658, attackSpeedPerLevel: 3, range: 600, moveSpeed: 325 },
    ability: { name: 'Salve', kind: 'aoe', damageType: 'physical', base: 20, perLevel: 15, adRatio: 1, apRatio: 0, cooldown: 7, range: 1200, radius: 300, origin: 'target', description: 'Décoche une volée de flèches en cône.' },
  },
  {
    id: 'leona', name: 'Leona', title: "L'Aube radieuse", archetype: 'tank', roles: ['support'], iconKey: 'Leona',
    stats: { hp: 646, hpPerLevel: 101, hpRegen5: 8.5, hpRegen5PerLevel: 0.85, ad: 60, adPerLevel: 3, armor: 43, armorPerLevel: 4.8, mr: 32, mrPerLevel: 2.05, attackSpeed: 0.625, attackSpeedPerLevel: 2.9, range: 125, moveSpeed: 335 },
    ability: { name: 'Éclipse', kind: 'shield', damageType: 'magic', base: 80, perLevel: 25, adRatio: 0, apRatio: 0.3, cooldown: 12, range: 0, duration: 3, description: 'Se protège derrière un bouclier solaire.' },
  },
  {
    id: 'soraka', name: 'Soraka', title: "L'Enfant des étoiles", archetype: 'support', roles: ['support'], iconKey: 'Soraka',
    stats: { hp: 605, hpPerLevel: 88, hpRegen5: 2.5, hpRegen5PerLevel: 0.5, ad: 50, adPerLevel: 3, armor: 32, armorPerLevel: 5, mr: 30, mrPerLevel: 1.3, attackSpeed: 0.625, attackSpeedPerLevel: 2.14, range: 550, moveSpeed: 325 },
    ability: { name: 'Infusion astrale', kind: 'heal', damageType: 'magic', base: 90, perLevel: 20, adRatio: 0, apRatio: 0.35, cooldown: 7, range: 550, description: 'Soigne l’allié le plus blessé à proximité.' },
  },
];

export const CHAMPIONS_BY_ID: Record<string, ChampionDef> = Object.fromEntries(CHAMPIONS.map((c) => [c.id, c]));

export const getChampionIcon = (def: ChampionDef) => championIconUrl(def.iconKey);

/**
 * Five distinct champions, one per role, preferring champions whose recommended roles match.
 * `random` returns [0, 1) (Math.random, or a seeded generator).
 */
export function randomComposition(pool: ChampionDef[] = CHAMPIONS, random: () => number = Math.random): ChampionPick[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return ROLES.flatMap((role) => {
    const idx = shuffled.findIndex((c) => c.roles.includes(role));
    const [chosen] = shuffled.splice(idx >= 0 ? idx : 0, 1);
    return chosen ? [{ championId: chosen.id, role }] : [];
  });
}
