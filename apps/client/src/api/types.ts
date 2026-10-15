import type { ChampionDef, ChampionPick } from '@macrogod/shared';

export interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type CatalogChampion = ChampionDef & { unlocked: boolean };

export type MatchStatus = 'in_progress' | 'victory' | 'defeat' | 'abandoned';

export interface MatchChampionStats {
  championId: string;
  level: number;
  kills: number;
  deaths: number;
  cs: number;
  gold: number;
}

export interface Match {
  id: string;
  seed: number;
  composition: ChampionPick[];
  enemyComposition: ChampionPick[] | null;
  status: MatchStatus;
  durationSec: number | null;
  stats: MatchChampionStats[] | null;
  createdAt: string;
  finishedAt: string | null;
}
