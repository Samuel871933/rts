import { CHAMPIONS_BY_ID, ITEMS_BY_ID, MONSTER_STATS, type CampKind, type Game, type GameEventRecord, type Team } from '@macrogod/shared';
import { LANE_LABELS } from '../../i18n/labels';
import type { FeedEntry } from './hudSnapshot';

const TIER_LABELS = { outer: 'extérieure', inner: 'intérieure', inhib: "d'inhibiteur", nexus: 'du Nexus' } as const;

function championName(game: Game, id: number | null): string {
  const c = id !== null ? game.champion(id) : undefined;
  return c ? CHAMPIONS_BY_ID[c.defId].name : '?';
}

function campName(game: Game, campId: string): string {
  const camp = game.state.camps.find((c) => c.def.id === campId);
  return camp ? MONSTER_STATS[camp.def.kind as CampKind].name : campId;
}

/** Turns simulation events into the short French lines of the in-game feed (null = not worth showing). */
export function describeEvent(game: Game, e: GameEventRecord, playerTeam: Team): Omit<FeedEntry, 'id'> | null {
  const line = (text: string, tone: FeedEntry['tone']) => ({ time: e.time, text, tone });
  /** Only our own champions' private events (levels, buys, recalls...) are reported. */
  const ours = (championId: number | null) => championId !== null && game.champion(championId)?.team === playerTeam;
  switch (e.type) {
    case 'championDied': {
      const victim = championName(game, e.championId);
      const by = e.killerId !== null ? ` par ${championName(game, e.killerId)}` : '';
      return ours(e.championId)
        ? line(`${victim} a été tué${by} (retour dans ${Math.ceil(e.respawnIn)}s)`, 'bad')
        : line(`${victim} (adverse) éliminé${by}`, 'good');
    }
    case 'levelUp':
      return ours(e.championId) && (e.level === 6 || e.level === 11 || e.level === 16)
        ? line(`${championName(game, e.championId)} passe niveau ${e.level}`, 'good')
        : null;
    case 'itemBought': {
      const item = ITEMS_BY_ID[e.itemId];
      return ours(e.championId) && item.cost >= 2000 ? line(`${championName(game, e.championId)} achète ${item.name}`, 'good') : null;
    }
    case 'structureDestroyed': {
      const allied = e.team === playerTeam;
      const what =
        e.kind === 'nexus'
          ? 'Le Nexus'
          : e.kind === 'inhibitor'
            ? `L'inhibiteur ${e.lane ? LANE_LABELS[e.lane] : ''}`
            : `La tour ${TIER_LABELS[e.tier]}${e.lane ? ` ${LANE_LABELS[e.lane]}` : ''}`;
      return line(`${what} ${allied ? 'allié(e)' : 'ennemi(e)'} est détruit(e)`, allied ? 'bad' : 'good');
    }
    case 'inhibitorRespawned':
      return line(`Un inhibiteur ${e.team === playerTeam ? 'allié' : 'ennemi'} est reconstruit`, 'neutral');
    case 'campSpawned':
      return e.epic ? line(`${campName(game, e.campId)} est apparu`, 'epic') : null;
    case 'campCleared':
      if (!e.epic) return null;
      return e.team === playerTeam
        ? line(`${campName(game, e.campId)} vaincu par ${championName(game, e.championId)}`, 'epic')
        : line(`L'équipe adverse a pris ${campName(game, e.campId)}`, 'bad');
    case 'buffGained':
      if (e.buff === 'baron' || !ours(e.championId)) return null;
      return line(`${championName(game, e.championId)} obtient le buff ${e.buff === 'blue' ? 'bleu' : 'rouge'}`, 'good');
    case 'autoRetreat':
      if (!ours(e.championId)) return null;
      return line(`${championName(game, e.championId)} se replie (PV bas)`, 'neutral');
    case 'recallCancelled':
      if (!ours(e.championId)) return null;
      return line(`Rappel de ${championName(game, e.championId)} interrompu`, 'bad');
    case 'orderFailed':
      if (!ours(e.championId)) return null;
      return line(
        e.reason === 'noWardCharge'
          ? `${championName(game, e.championId)} n'a plus de balise`
          : 'Cible invulnérable : détruis d’abord les structures précédentes',
        'neutral',
      );
    case 'victory':
      return line(e.winner === playerTeam ? 'VICTOIRE !' : 'DÉFAITE', e.winner === playerTeam ? 'epic' : 'bad');
    default:
      return null;
  }
}
