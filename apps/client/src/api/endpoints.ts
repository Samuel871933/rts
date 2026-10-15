import type { ChampionPick } from '@macrogod/shared';
import { apiFetch } from './http';
import type { AuthResponse, CatalogChampion, Match, MatchChampionStats, MatchStatus, User } from './types';

export const authApi = {
  register: (input: { username: string; email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  login: (input: { login: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  me: () => apiFetch<{ user: User }>('/auth/me').then((r) => r.user),
};

export const championsApi = {
  list: () => apiFetch<{ champions: CatalogChampion[] }>('/champions').then((r) => r.champions),
};

export const matchesApi = {
  list: () => apiFetch<{ matches: Match[] }>('/matches').then((r) => r.matches),
  get: (id: string) => apiFetch<{ match: Match }>(`/matches/${id}`).then((r) => r.match),
  create: (composition: ChampionPick[]) =>
    apiFetch<{ match: Match }>('/matches', { method: 'POST', body: { composition } }).then((r) => r.match),
  finish: (id: string, input: { status: Exclude<MatchStatus, 'in_progress'>; durationSec: number; stats?: MatchChampionStats[] }) =>
    apiFetch<{ match: Match }>(`/matches/${id}/finish`, { method: 'PATCH', body: input }).then((r) => r.match),
};
