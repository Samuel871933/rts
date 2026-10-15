import type { Order } from '@macrogod/shared';
import { LANE_LABELS } from '../../i18n/labels';

export function orderLabel(order: Order): string {
  switch (order.type) {
    case 'lane':
      return `Lane ${LANE_LABELS[order.lane]}`;
    case 'jungle':
      return 'Jungle';
    case 'move':
      return 'Déplacement';
    case 'attackMove':
      return 'Attaque-déplacement';
    case 'attack':
      return 'Attaque ciblée';
    case 'camp':
      return 'Camp';
    case 'ward':
      return 'Balise';
    case 'recall':
      return 'Rappel';
    case 'follow':
      return 'Escorte';
    case 'idle':
      return 'Position tenue';
  }
}
