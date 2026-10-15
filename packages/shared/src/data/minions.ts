export type MinionType = 'melee' | 'caster' | 'siege' | 'super';

export interface MinionStats {
  hp: number;
  ad: number;
  attackSpeed: number;
  range: number;
  armor: number;
  mr: number;
  radius: number;
  gold: number;
  xp: number;
  /** Added every upgrade (every 90s from 0:30). The wiki only gives min–max ranges: approximations. */
  hpPerUpgrade: number;
  adPerUpgrade: number;
  /** Extra gold per upgrade (siege and super minions). */
  goldPerUpgrade: number;
}

/** LoL wiki, patch V26.x. */
export const MINION_STATS: Record<MinionType, MinionStats> = {
  melee: { hp: 465, ad: 11, attackSpeed: 1.25, range: 110, armor: 0, mr: 0, radius: 48, gold: 20, xp: 62, hpPerUpgrade: 22, adPerUpgrade: 3.4, goldPerUpgrade: 0 },
  caster: { hp: 284, ad: 21, attackSpeed: 0.667, range: 550, armor: 0, mr: 0, radius: 48, gold: 14, xp: 31, hpPerUpgrade: 6.5, adPerUpgrade: 1.5, goldPerUpgrade: 0 },
  siege: { hp: 835, ad: 37.5, attackSpeed: 1, range: 300, armor: 0, mr: 0, radius: 65, gold: 50, xp: 75, hpPerUpgrade: 62, adPerUpgrade: 4, goldPerUpgrade: 1 },
  super: { hp: 1600, ad: 185, attackSpeed: 0.85, range: 170, armor: 100, mr: -30, radius: 65, gold: 50, xp: 75, hpPerUpgrade: 100, adPerUpgrade: 5, goldPerUpgrade: 1 },
};

/** LoL wiki: waves every 30s from 0:30, 25s from 14:00, 20s from 30:00; minions 0.792s apart. */
export const WAVE_RULES = {
  firstWaveAt: 30,
  spawnGap: 0.792,
  upgradeInterval: 90,
  sightRange: 1200,
};

export function waveInterval(time: number): number {
  if (time >= 30 * 60) return 20;
  if (time >= 14 * 60) return 25;
  return 30;
}

/** Siege minion every 3rd wave until 14:00, then on odd waves (29, 31...), then every wave from 25:15. */
export function waveHasSiege(waveNumber: number, time: number): boolean {
  if (time >= 25 * 60 + 15) return true;
  if (time >= 14 * 60) return waveNumber % 2 === 1;
  return waveNumber % 3 === 0;
}

export function minionMoveSpeed(time: number): number {
  const minutes = time / 60;
  if (minutes >= 25) return 450;
  if (minutes >= 20) return 425;
  if (minutes >= 15) return 400;
  if (minutes >= 10) return 375;
  return 350;
}
