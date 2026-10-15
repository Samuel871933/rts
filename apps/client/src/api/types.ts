import type { ChampionDef, ChampionPick, MatchChampionStats, MatchClock, PlayerSettings, TimedCommand } from '@macrogod/shared';

export type { MatchChampionStats };

export interface User {
  id: number;
  username: string;
  email: string;
  settings: PlayerSettings;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type CatalogChampion = ChampionDef & { unlocked: boolean };

export type MatchStatus = 'in_progress' | 'victory' | 'defeat' | 'abandoned';

export interface Match {
  id: string;
  seed: number;
  composition: ChampionPick[];
  enemyComposition: ChampionPick[] | null;
  status: MatchStatus;
  clock: MatchClock | null;
  durationSec: number | null;
  stats: MatchChampionStats[] | null;
  createdAt: string;
  finishedAt: string | null;
}

/** What it takes to rebuild a running game: its schedule, its command log and the server time. */
export interface MatchLog {
  clock: MatchClock | null;
  commands: TimedCommand[];
  serverNow: number;
}

/** The server computes where the game stands: the client only sets speed and pause. */
export type ClockInput = Pick<MatchClock, 'speed' | 'paused'>;
