import { useGameContext, useHud } from '../core/GameSessionContext';
import { LETTER_KEYS, type HotkeyAction } from '../input/hotkeys';
import styles from './hud.module.css';

interface ActionDef {
  icon: string;
  label: string;
  hint: string;
  key: string;
  action: HotkeyAction;
}

const GROUPS: { title: string; actions: ActionDef[] }[] = [
  {
    title: 'Assigner',
    actions: [
      { icon: '⬆', label: 'Top', hint: 'Farmer / tenir la lane top', key: LETTER_KEYS.top, action: { type: 'lane', lane: 'top' } },
      { icon: '↗', label: 'Mid', hint: 'Farmer / tenir la lane mid', key: LETTER_KEYS.mid, action: { type: 'lane', lane: 'mid' } },
      { icon: '➡', label: 'Bot', hint: 'Farmer / tenir la lane bot', key: LETTER_KEYS.bot, action: { type: 'lane', lane: 'bot' } },
      { icon: '🌲', label: 'Jungle', hint: 'Nettoyer les camps de son côté', key: LETTER_KEYS.jungle, action: { type: 'jungle' } },
    ],
  },
  {
    title: 'Actions',
    actions: [
      { icon: '⚔', label: 'Attaque', hint: 'Attaque-déplacement : puis clic sur la carte', key: LETTER_KEYS.attackMove, action: { type: 'mode', mode: 'attackMove' } },
      { icon: '🏠', label: 'Rappel', hint: 'Retour à la base (8 s), achats automatiques', key: LETTER_KEYS.recall, action: { type: 'recall' } },
      { icon: '✋', label: 'Stop', hint: 'Tenir la position', key: LETTER_KEYS.stop, action: { type: 'stop' } },
    ],
  },
];

/** Vertical bar beside the map: orders for the selected champions (also reachable from quick actions). */
export function ActionBar() {
  const { controls } = useGameContext();
  const hud = useHud();
  const none = hud.selection.length === 0;

  return (
    <nav className={`${styles.panel} ${styles.actionBar}`} aria-label="Actions">
      {GROUPS.map((group) => (
        <div key={group.title} className={styles.actionGroup}>
          <span className={styles.groupLabel}>{group.title}</span>
          {group.actions.map((a) => (
            <button
              key={a.label}
              className={`${styles.actionButton} ${a.action.type === 'mode' && hud.commandMode === a.action.mode ? styles.active : ''}`}
              disabled={none}
              title={`${a.hint} (${a.key.toUpperCase()})`}
              onClick={() => controls.runAction(a.action)}
            >
              <span className={styles.actionIcon}>{a.icon}</span>
              <span>{a.label}</span>
              <kbd>{a.key.toUpperCase()}</kbd>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
