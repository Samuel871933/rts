import type { Role } from '../types';
import type { Archetype } from './champions';

export interface ItemStats {
  ad: number;
  ap: number;
  hp: number;
  armor: number;
  mr: number;
  /** Bonus attack speed, as a ratio (0.25 = +25%). */
  attackSpeed: number;
  moveSpeed: number;
  abilityHaste: number;
}

export interface ItemDef {
  id: string;
  name: string;
  cost: number;
  iconId: number;
  starter?: boolean;
  stats: Partial<ItemStats>;
}

const item = (id: string, name: string, cost: number, iconId: number, stats: Partial<ItemStats>, starter = false): ItemDef => ({
  id, name, cost, iconId, stats, starter,
});

/** Simplified LoL items: bought whole (no recipes) when the champion is at the fountain. */
export const ITEMS: ItemDef[] = [
  item('dorans_blade', "Lame de Doran", 450, 1055, { ad: 10, hp: 80 }, true),
  item('dorans_shield', "Bouclier de Doran", 450, 1054, { hp: 110 }, true),
  item('dorans_ring', "Anneau de Doran", 400, 1056, { ap: 18, hp: 90 }, true),
  item('jungle_pet', 'Chiot de griffebrûle', 450, 1101, { ad: 5 }, true),
  item('world_atlas', 'Atlas du monde', 400, 3865, { hp: 30, abilityHaste: 5 }, true),

  item('berserkers', 'Jambières du berserker', 1100, 3006, { attackSpeed: 0.25, moveSpeed: 45 }),
  item('steelcaps', "Coques en acier", 1200, 3047, { armor: 25, moveSpeed: 45 }),
  item('sorcerers', 'Chaussures du sorcier', 1100, 3020, { ap: 12, moveSpeed: 45 }),
  item('ionian', 'Bottes ioniennes', 900, 3158, { abilityHaste: 15, moveSpeed: 45 }),

  item('trinity', 'Force de la trinité', 3333, 3078, { ad: 36, hp: 300, attackSpeed: 0.3, abilityHaste: 15 }),
  item('cleaver', 'Couperet noir', 3000, 3071, { ad: 40, hp: 400, abilityHaste: 20 }),
  item('steraks', 'Gage de Sterak', 3200, 3053, { hp: 400, ad: 30 }),
  item('spirit_visage', "Visage spirituel", 2700, 3065, { hp: 400, mr: 50, abilityHaste: 10 }),
  item('dead_mans', "Plaque du mort", 2900, 3742, { hp: 350, armor: 55, moveSpeed: 20 }),
  item('sunfire', 'Égide de feu solaire', 2800, 3068, { hp: 350, armor: 50 }),
  item('thornmail', "Cotte épineuse", 2450, 3075, { hp: 150, armor: 75 }),
  item('warmogs', "Armure de Warmog", 3100, 3083, { hp: 1000 }),
  item('randuins', "Présage de Randuin", 2700, 3143, { hp: 350, armor: 75 }),
  item('ludens', 'Compagnon de Luden', 2750, 6655, { ap: 95, abilityHaste: 20 }),
  item('zhonyas', 'Sablier de Zhonya', 3250, 3157, { ap: 105, armor: 50, abilityHaste: 15 }),
  item('rabadons', 'Coiffe de Rabadon', 3500, 3089, { ap: 140 }),
  item('void_staff', 'Bâton du vide', 3000, 3135, { ap: 95 }),
  item('morello', 'Morellonomicon', 2850, 3165, { ap: 75, hp: 350 }),
  item('kraken', 'Tueur de krakens', 3000, 6672, { ad: 45, attackSpeed: 0.4 }),
  item('infinity_edge', "Lame d'infinité", 3500, 3031, { ad: 80 }),
  item('lord_dominik', 'Salutations de Dominik', 3300, 3036, { ad: 40 }),
  item('bloodthirster', 'Soif-de-sang', 3400, 3072, { ad: 80 }),
  item('guardian_angel', 'Ange gardien', 3200, 3026, { ad: 55, armor: 45 }),
  item('moonstone', 'Renouveau de pierre de lune', 2200, 6617, { ap: 25, hp: 200, abilityHaste: 20 }),
  item('redemption', 'Rédemption', 2250, 3107, { hp: 200, abilityHaste: 15 }),
  item('locket', 'Médaillon des Solari de fer', 2200, 3190, { hp: 200, armor: 25, mr: 25, abilityHaste: 10 }),
  item('shurelya', 'Requiem de Shurelya', 2200, 2065, { ap: 50, abilityHaste: 15, moveSpeed: 20 }),
];

export const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const MAX_ITEM_SLOTS = 6;

/** Build order per archetype (first entry is the starter). */
const BUILDS: Record<Archetype, string[]> = {
  fighter: ['dorans_blade', 'steelcaps', 'trinity', 'cleaver', 'steraks', 'spirit_visage', 'dead_mans'],
  assassin: ['dorans_blade', 'steelcaps', 'cleaver', 'trinity', 'steraks', 'guardian_angel', 'spirit_visage'],
  tank: ['dorans_shield', 'steelcaps', 'sunfire', 'thornmail', 'spirit_visage', 'warmogs', 'randuins'],
  mage: ['dorans_ring', 'sorcerers', 'ludens', 'zhonyas', 'rabadons', 'void_staff', 'morello'],
  marksman: ['dorans_blade', 'berserkers', 'kraken', 'infinity_edge', 'lord_dominik', 'bloodthirster', 'guardian_angel'],
  support: ['world_atlas', 'ionian', 'moonstone', 'redemption', 'locket', 'shurelya', 'warmogs'],
};

export function buildFor(archetype: Archetype, role: Role): string[] {
  const build = [...BUILDS[archetype]];
  if (role === 'jungle') build[0] = 'jungle_pet';
  if (role === 'support') build[0] = 'world_atlas';
  return build;
}
