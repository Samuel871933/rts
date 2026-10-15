import type { ChampionPick, MatchClock, PlayerSettings, TimedCommand } from '@macrogod/shared';
import { apiFetch } from './http';
import type {
  AuthResponse,
  CatalogChampion,
  ClockInput,
  Match,
  MatchLog,
  User,
} from './types';

export const authApi = {
  register: (input: { username: string; email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  login: (input: { login: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  me: () => apiFetch<{ user: User }>('/auth/me').then((r) => r.user),
  updateSettings: (settings: PlayerSettings) =>
    apiFetch<{ user: User }>('/auth/me/settings', { method: 'PUT', body: settings }).then((r) => r.user),
};

export const championsApi = {
  list: () => apiFetch<{ champions: CatalogChampion[] }>('/champions').then((r) => r.champions),
};

export const matchesApi = {
  list: () => apiFetch<{ matches: Match[] }>('/matches').then((r) => r.matches),
  get: (id: string) => apiFetch<{ match: Match }>(`/matches/${id}`).then((r) => r.match),
  create: (composition: ChampionPick[]) =>
    apiFetch<{ match: Match }>('/matches', { method: 'POST', body: { composition } }).then((r) => r.match),
  log: (id: string) => apiFetch<MatchLog>(`/matches/${id}/log`),
  addCommand: (id: string, command: TimedCommand) =>
    apiFetch<{ ok: true }>(`/matches/${id}/commands`, { method: 'POST', body: command, keepalive: true }),
  setClock: (id: string, clock: ClockInput) =>
    apiFetch<{ clock: MatchClock }>(`/matches/${id}/clock`, { method: 'PUT', body: clock, keepalive: true }).then((r) => r.clock),
  /** Surrender (victories and defeats are recorded by the server's own simulation). */
  abandon: (id: string) =>
    apiFetch<{ match: Match }>(`/matches/${id}/finish`, { method: 'PATCH', body: { status: 'abandoned' } }).then((r) => r.match),
};
