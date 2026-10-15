export type Team = 'blue' | 'red';
export type Side = Team | 'neutral';
export type Lane = 'top' | 'mid' | 'bot';
export type Role = 'top' | 'jungle' | 'mid' | 'bot' | 'support';

export const TEAMS: readonly Team[] = ['blue', 'red'];
export const LANES: readonly Lane[] = ['top', 'mid', 'bot'];
export const ROLES: readonly Role[] = ['top', 'jungle', 'mid', 'bot', 'support'];

export const enemyOf = (team: Team): Team => (team === 'blue' ? 'red' : 'blue');

export interface ChampionPick {
  championId: string;
  role: Role;
}
