/**
 * Global LoL rules, in game seconds (see constants.DEFAULT_TIME_SCALE for the real-time speed-up).
 * Sources: LoL wiki (Experience, Death, Minion, Turret pages).
 */
export const RULES = {
  startGold: 500,
  passiveGoldStart: 65,
  passiveGoldPerSecond: 2.04,

  maxLevel: 18,
  /** Minion XP is shared by champions within this radius. Two or more share a 130% pool. */
  xpShareRadius: 1500,
  xpSharedPoolBonus: 1.3,
  championKillXpRadius: 1600,
  /** Kill bounty: 300 up to level 6, then +10 per level (420 at 18). First blood +100. */
  championKillGold: 300,
  championKillGoldPerLevelAfter6: 10,
  firstBloodBonus: 100,

  recallDuration: 8,
  baronRecallDuration: 4,
  fountainRadius: 1000,
  /** Fountain: 8% max HP per second plus 8% of missing HP every 0.5s. */
  fountainHealRatio: 0.08,
  fountainMissingHealPerSecond: 0.16,

  acquisitionRange: 700,
  championSight: 1350,
  turretSight: 1350,
  baseStructureSight: 1200,
  wardSight: 900,
  wardMaxCharges: 2,
  wardMaxActivePerChampion: 3,
  wardPlaceRange: 625,

  turretRange: 750,
  /** Each consecutive turret shot on a champion deals +50% damage, up to +150%, reset after 5s. */
  turretRampPerShot: 0.5,
  turretRampMax: 1.5,
  turretRampReset: 5,
  /** Turret shots against minions deal a share of their max HP (siege share drops with turret tier). */
  turretVsMinionMaxHp: { melee: 0.45, caster: 0.7, super: 0.07 },
  turretVsSiegeMaxHp: { outer: 0.14, inner: 0.11, inhib: 0.08, nexus: 0.08 },
  minionDamageToStructures: 0.6,
  siegeDamageToTurrets: 0.84,
  /** Outer turrets reach full damage at 14:00; inner tiers are assumed to scale until 30:00. */
  outerTurretRampEnd: 14 * 60,
  turretRampEnd: 30 * 60,
  inhibitorRespawn: 300,

  /** Smite: 2 charges (90s recharge each, 2nd ready at 0:48), 15s between casts. */
  smiteDamage: 600,
  smiteRecharge: 90,
  smiteMaxCharges: 2,
  smiteFirstRecharge: 48,
  smiteLockout: 15,
  /** Jungle companion: bonus true damage on hit vs monsters, reduced damage taken from monsters. */
  jungleCompanionBonusDamage: 45,
  jungleCompanionDamageTaken: 0.5,
  jungleCompanionHealOnKill: 120,
  /** Bonus XP per large monster killed by the jungler (+150 for the first one). */
  jungleCompanionXp: 80,
  jungleCompanionFirstXp: 150,

  dragonDamagePerStack: 0.05,
  dragonMaxStacks: 4,
  baronDuration: 180,
  /** Hand of Baron scales with game time: 12 → 48 AD and 20 → 80 AP (assumed linear 20:00 → 40:00). */
  baronAd: [12, 48],
  baronAp: [20, 80],
  baronKillerGold: 100,
  buffDuration: 120,

  /**
   * Champions never start a fight with an enemy champion on their own (only player orders do),
   * but they hit back at a champion that attacked them within this window (seconds).
   */
  championRetaliationWindow: 2,
  escortDistance: 350,
  /** "Farm auto": a champion left without any order this long (seconds) resumes its usual job. */
  autoFarmDelay: 15,
} as const;

/** Cumulative XP needed to reach level index+1 (index 0 = level 1). */
export const XP_TABLE = [
  0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360,
];

/** Base respawn wait by level (index 0 = level 1). */
const BASE_RESPAWN = [10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5];

/** Death timer = BRW + BRW * time increase factor (capped at 50%). */
export function respawnTime(level: number, gameTime: number): number {
  const brw = BASE_RESPAWN[Math.min(level, 18) - 1] ?? 52.5;
  const minutes = gameTime / 60;
  const halfMinutes = (from: number) => Math.ceil((minutes - from) * 2);
  let tif = 0;
  if (minutes >= 45) tif = 0.2175 + 0.0145 * halfMinutes(45);
  else if (minutes >= 30) tif = 0.1275 + 0.003 * halfMinutes(30);
  else if (minutes >= 15) tif = 0.00425 * halfMinutes(15);
  return brw * (1 + Math.min(tif, 0.5));
}

/** LoL stat growth curve: base + growth * (n-1) * (0.7025 + 0.0175 * (n-1)). */
export const statAtLevel = (base: number, growth: number, level: number): number =>
  base + growth * (level - 1) * (0.7025 + 0.0175 * (level - 1));

/** Hand of Baron bonus at a given game time. */
export function baronBonus(gameTime: number): { ad: number; ap: number } {
  const t = Math.min(1, Math.max(0, (gameTime / 60 - 20) / 20));
  return {
    ad: RULES.baronAd[0] + (RULES.baronAd[1] - RULES.baronAd[0]) * t,
    ap: RULES.baronAp[0] + (RULES.baronAp[1] - RULES.baronAp[0]) * t,
  };
}

export const championKillBounty = (victimLevel: number) =>
  RULES.championKillGold + Math.max(0, victimLevel - 6) * RULES.championKillGoldPerLevelAfter6;

export function wardDuration(level: number): number {
  return 90 + (30 * (level - 1)) / 17;
}

export function wardRechargeTime(level: number): number {
  return 210 - (90 * (level - 1)) / 17;
}
