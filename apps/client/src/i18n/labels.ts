import type { Activity, Archetype, Lane, Role } from '@macrogod/shared';
import type { MatchStatus } from '../api/types';

export const ROLE_LABELS: Record<Role, string> = {
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Mid',
  bot: 'Bot',
  support: 'Support',
};

export const LANE_LABELS: Record<Lane, string> = { top: 'Top', mid: 'Mid', bot: 'Bot' };

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  fighter: 'Combattant',
  tank: 'Tank',
  mage: 'Mage',
  marksman: 'Tireur',
  support: 'Soutien',
  assassin: 'Assassin',
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  idle: 'En attente',
  moving: 'Déplacement',
  fighting: 'Combat',
  farming: 'Farm',
  pushing: 'Avance avec la vague',
  jungling: 'Jungle',
  sieging: 'Attaque une structure',
  retreating: 'Repli',
  recalling: 'Rappel',
  warding: 'Pose une balise',
  escorting: 'Escorte',
  waiting: 'Attend',
  shopping: 'Soins / achats',
  dead: 'Mort',
};

export const STATUS_LABELS: Record<MatchStatus, string> = {
  in_progress: 'En cours',
  victory: 'Victoire',
  defeat: 'Défaite',
  abandoned: 'Abandon',
};

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatGold(gold: number): string {
  return gold >= 10000 ? `${(gold / 1000).toFixed(1)}k` : String(Math.floor(gold));
}
