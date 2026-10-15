import { CHAMPIONS_BY_ID, LANES, MONSTER_STATS, isStructure, laneTrack, type Order, type Unit, type Vec2 } from '@macrogod/shared';
import { LANE_LABELS } from '../../i18n/labels';
import type { GameSession } from '../core/GameSession';

export interface RadialAction {
  id: string;
  icon: string;
  label: string;
  /** Order sent to every selected champion (the target itself is skipped for ally actions). */
  order: Order;
  tone?: 'attack' | 'support' | 'neutral';
}

export interface RadialMenuModel {
  title: string;
  actions: RadialAction[];
}

function unitName(session: GameSession, u: Unit): string {
  switch (u.kind) {
    case 'champion':
      return CHAMPIONS_BY_ID[u.defId].name;
    case 'monster': {
      const camp = session.game.state.camps.find((c) => c.def.id === u.campId);
      return camp ? MONSTER_STATS[camp.def.kind].name : 'Monstre';
    }
    case 'minion':
      return `Sbire ${LANE_LABELS[u.lane]}`;
    case 'turret':
      return u.lane ? `Tour ${LANE_LABELS[u.lane]}` : 'Tour du Nexus';
    case 'inhibitor':
      return `Inhibiteur ${u.lane ? LANE_LABELS[u.lane] : ''}`;
    case 'nexus':
      return 'Nexus';
    case 'ward':
      return 'Balise';
  }
}

/** Contextual actions for the selected champions on a clicked unit. */
export function radialMenuFor(session: GameSession, target: Unit): RadialMenuModel {
  const ward: RadialAction = { id: 'ward', icon: '👁', label: 'Balise ici', order: { type: 'ward', pos: { ...target.pos } }, tone: 'neutral' };
  const attack = (label: string, icon = '⚔'): RadialAction => ({
    id: 'attack',
    icon,
    label,
    order: { type: 'attack', targetId: target.id },
    tone: 'attack',
  });
  const lane = (verb: string): RadialAction[] =>
    'lane' in target && target.lane
      ? [{ id: 'lane', icon: '➜', label: `${verb} ${LANE_LABELS[target.lane]}`, order: { type: 'lane', lane: target.lane }, tone: 'neutral' }]
      : [];
  const title = unitName(session, target);
  const ally = target.team === session.team;

  if (target.kind === 'champion' && ally) {
    return {
      title,
      actions: [
        { id: 'follow', icon: '🛡', label: 'Escorter', order: { type: 'follow', targetId: target.id }, tone: 'support' },
        { id: 'join', icon: '➜', label: 'Rejoindre', order: { type: 'move', pos: { ...target.pos } }, tone: 'neutral' },
        ward,
      ],
    };
  }
  if (target.kind === 'champion') return { title, actions: [attack('Attaquer'), ward] };
  if (target.kind === 'monster') {
    return { title, actions: [attack(target.epic ? 'Prendre l’objectif' : 'Nettoyer le camp', target.epic ? '🐉' : '⚔'), ward] };
  }
  if (isStructure(target)) {
    if (ally) return { title, actions: [...lane('Défendre'), ward] };
    return { title, actions: [attack('Assiéger', '🏰'), ...lane('Pousser'), ward] };
  }
  if (target.kind === 'minion') {
    return { title, actions: ally ? [...lane('Tenir'), ward] : [attack('Attaquer'), ...lane('Pousser'), ward] };
  }
  return { title, actions: [ward] };
}

/** Within this distance of a lane centerline, the ground ring also offers to hold that lane. */
const LANE_SNAP = 900;

/** Quick actions on an empty point of the map. */
export function groundMenuFor(session: GameSession, pos: Vec2): RadialMenuModel {
  const at = { x: pos.x, y: pos.y };
  const actions: RadialAction[] = [
    { id: 'move', icon: '➜', label: 'Aller ici', order: { type: 'move', pos: at }, tone: 'neutral' },
    { id: 'attackMove', icon: '⚔', label: 'Attaque-dépl.', order: { type: 'attackMove', pos: at }, tone: 'attack' },
    { id: 'ward', icon: '👁', label: 'Balise ici', order: { type: 'ward', pos: at }, tone: 'neutral' },
    { id: 'recall', icon: '🏠', label: 'Rappel', order: { type: 'recall' }, tone: 'neutral' },
  ];
  const lane = LANES.map((l) => ({ lane: l, offset: laneTrack(session.team, l).project(pos).offset })).sort(
    (a, b) => a.offset - b.offset,
  )[0];
  if (lane.offset < LANE_SNAP) {
    actions.push({ id: 'lane', icon: '🛡', label: `Tenir ${LANE_LABELS[lane.lane]}`, order: { type: 'lane', lane: lane.lane }, tone: 'support' });
  }
  return { title: lane.offset < LANE_SNAP ? `Lane ${LANE_LABELS[lane.lane]}` : 'Ici', actions };
}
