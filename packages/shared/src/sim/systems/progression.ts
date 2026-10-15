import { CHAMPIONS_BY_ID } from '../../data/champions';
import { ITEMS_BY_ID, MAX_ITEM_SLOTS, buildFor, type ItemStats } from '../../data/items';
import { RULES, XP_TABLE, baronBonus, statAtLevel } from '../../data/rules';
import type { Vec2 } from '../../math';
import type { Team } from '../../types';
import type { Game } from '../Game';
import { aliveChampionsNear } from '../queries';
import type { ChampionUnit } from '../types';

export function addGold(game: Game, c: ChampionUnit, amount: number) {
  c.gold += amount;
  c.totalGold += amount;
  game.state.teams[c.team].gold += amount;
}

export function addXp(game: Game, c: ChampionUnit, amount: number) {
  if (c.level >= RULES.maxLevel) return;
  c.xp += amount;
  let leveled = false;
  while (c.level < RULES.maxLevel && c.xp >= XP_TABLE[c.level]) {
    c.level++;
    leveled = true;
    game.emit({ type: 'levelUp', championId: c.id, level: c.level });
  }
  if (leveled) recomputeChampionStats(game, c);
}

/** Minion-style XP: 100% solo, otherwise a 130% pool split between nearby champions. */
export function shareXp(game: Game, team: Team, pos: Vec2, amount: number, radius: number = RULES.xpShareRadius) {
  const recipients = aliveChampionsNear(game, team, pos, radius);
  if (recipients.length === 0) return;
  const each = recipients.length === 1 ? amount : (amount * RULES.xpSharedPoolBonus) / recipients.length;
  for (const c of recipients) addXp(game, c, each);
}

function sumItemStats(items: string[]): ItemStats {
  const total: ItemStats = { ad: 0, ap: 0, hp: 0, armor: 0, mr: 0, attackSpeed: 0, moveSpeed: 0, abilityHaste: 0 };
  for (const id of items) {
    const stats = ITEMS_BY_ID[id]?.stats ?? {};
    for (const key of Object.keys(stats) as (keyof ItemStats)[]) total[key] += stats[key] ?? 0;
  }
  return total;
}

export function recomputeChampionStats(game: Game, c: ChampionUnit) {
  const s = CHAMPIONS_BY_ID[c.defId].stats;
  const lvl = c.level;
  const items = sumItemStats(c.items);
  const baron = c.buffs.baron > game.state.time;
  const hand = baronBonus(game.state.time);

  const maxHp = statAtLevel(s.hp, s.hpPerLevel, lvl) + items.hp;
  if (c.alive) c.hp = Math.min(maxHp, c.hp + Math.max(0, maxHp - c.maxHp));
  c.maxHp = maxHp;

  c.baseAd = statAtLevel(s.ad, s.adPerLevel, lvl);
  c.ad = c.baseAd + items.ad + (baron ? hand.ad : 0);
  c.ap = items.ap + (baron ? hand.ap : 0);
  c.armor = statAtLevel(s.armor, s.armorPerLevel, lvl) + items.armor;
  c.mr = statAtLevel(s.mr, s.mrPerLevel, lvl) + items.mr;
  const asGrowth = (s.attackSpeedPerLevel / 100) * (lvl - 1) * (0.7025 + 0.0175 * (lvl - 1));
  c.attackSpeed = Math.min(2.5, s.attackSpeed * (1 + asGrowth + items.attackSpeed));
  c.moveSpeed = s.moveSpeed + items.moveSpeed;
  c.abilityHaste = items.abilityHaste;
  c.hpRegen = statAtLevel(s.hpRegen5, s.hpRegen5PerLevel, lvl) / 5;
  c.range = s.range;
  c.hasBaron = baron;
}

/** Buys the next items of the champion's build while it can afford them (fountain only). */
export function autoBuy(game: Game, c: ChampionUnit) {
  const build = buildFor(CHAMPIONS_BY_ID[c.defId].archetype, c.role);
  let bought = false;
  for (;;) {
    const nextId = build.find((id) => !c.items.includes(id));
    if (!nextId) break;
    const next = ITEMS_BY_ID[nextId];
    if (c.gold < next.cost) break;
    if (c.items.length >= MAX_ITEM_SLOTS) {
      const starterIdx = c.items.findIndex((id) => ITEMS_BY_ID[id]?.starter);
      if (starterIdx < 0) break;
      const [sold] = c.items.splice(starterIdx, 1);
      c.gold += Math.floor(ITEMS_BY_ID[sold].cost * 0.4);
    }
    c.gold -= next.cost;
    c.items.push(nextId);
    bought = true;
    game.emit({ type: 'itemBought', championId: c.id, itemId: nextId });
  }
  if (bought) recomputeChampionStats(game, c);
}
