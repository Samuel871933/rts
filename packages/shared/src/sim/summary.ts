import type { Team } from '../types';
import type { Game } from './Game';

/** End-of-match line of one champion, as saved in the match history. */
export interface MatchChampionStats {
  championId: string;
  level: number;
  kills: number;
  deaths: number;
  cs: number;
  gold: number;
}

export function championSummaries(game: Game, team: Team): MatchChampionStats[] {
  return game.state.champions
    .filter((c) => c.team === team)
    .map((c) => ({
      championId: c.defId,
      level: c.level,
      kills: c.stats.kills,
      deaths: c.stats.deaths,
      cs: c.stats.cs,
      gold: Math.floor(c.totalGold),
    }));
}
