/** Summoner's Rift is ~14 800 units wide. Coordinates follow LoL: blue base bottom-left, y pointing up. */
export const MAP_SIZE = 14800;

/** Simulation ticks per *game* second. */
export const SIM_TICK_RATE = 20;
export const SIM_DT = 1 / SIM_TICK_RATE;

/**
 * Game time runs this many times faster than real time.
 * LoL timings (walk times, waves, respawns...) are kept as-is in game seconds,
 * so x3 turns a 30 min LoL game into ~10 real minutes.
 */
export const DEFAULT_TIME_SCALE = 3;
export const GAME_SPEEDS = [1, 2, 3, 5] as const;

export const NAV_CELL_SIZE = 100;

/** Data Dragon is only used for placeholder art until we ship our own champions. */
export const DDRAGON_VERSION = '14.24.1';
export const championIconUrl = (iconKey: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${iconKey}.png`;
export const itemIconUrl = (iconId: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${iconId}.png`;
