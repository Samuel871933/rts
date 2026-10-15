import type { BindingId, Order } from '@macrogod/shared';
import { ArrowRight, ArrowUp, ArrowUpRight, Hand, House, Swords, Trees, type LucideIcon } from 'lucide-react';
import { useGameContext, useHud } from '../core/GameSessionContext';
import type { HudChampion } from '../core/hudSnapshot';
import { keyLabel, type HotkeyAction } from '../input/hotkeys';
import { useKeybindings } from '../input/useKeybindings';
import styles from './ActionBar.module.css';

interface ActionDef {
  Icon: LucideIcon;
  label: string;
  hint: string;
  binding: BindingId;
  action: HotkeyAction;
  /** Assignments: lit when every selected champion already has this job. */
  job?: (o: Order | null) => boolean;
}

const isLane = (lane: string) => (o: Order | null) => o?.type === 'lane' && o.lane === lane;

const GROUPS: { title: string; actions: ActionDef[] }[] = [
  {
    title: 'Assigner',
    actions: [
      { Icon: ArrowUp, label: 'Top', hint: 'Farmer / tenir la lane top', binding: 'top', action: { type: 'lane', lane: 'top' }, job: isLane('top') },
      { Icon: ArrowUpRight, label: 'Mid', hint: 'Farmer / tenir la lane mid', binding: 'mid', action: { type: 'lane', lane: 'mid' }, job: isLane('mid') },
      { Icon: ArrowRight, label: 'Bot', hint: 'Farmer / tenir la lane bot', binding: 'bot', action: { type: 'lane', lane: 'bot' }, job: isLane('bot') },
      { Icon: Trees, label: 'Jungle', hint: 'Nettoyer les camps de son côté', binding: 'jungle', action: { type: 'jungle' }, job: (o) => o?.type === 'jungle' },
    ],
  },
  {
    title: 'Actions',
    actions: [
      { Icon: Swords, label: 'Attaque', hint: 'Attaque-déplacement : puis clic sur la carte', binding: 'attackMove', action: { type: 'mode', mode: 'attackMove' } },
      { Icon: House, label: 'Rappel', hint: 'Retour à la base (8 s), achats automatiques', binding: 'recall', action: { type: 'recall' } },
      { Icon: Hand, label: 'Stop', hint: 'Tenir la position', binding: 'stop', action: { type: 'stop' } },
    ],
  },
];

/** Current job of a champion: its standing lane / jungle order, or the order itself. */
const jobOf = (c: HudChampion): Order | null => c.standingOrder ?? c.order;

/** Vertical bar beside the map: orders for the selected champions (also reachable from quick actions). */
export function ActionBar() {
  const { controls } = useGameContext();
  const hud = useHud((h) => ({ champions: h.champions, selection: h.selection, commandMode: h.commandMode }));
  const keys = useKeybindings();
  const selected = hud.champions.filter((c) => hud.selection.includes(c.id));
  const none = selected.length === 0;

  return (
    <nav className={styles.bar} aria-label="Actions">
      {GROUPS.map((group) => (
        <div key={group.title} className={styles.group}>
          <span className={styles.title}>{group.title}</span>
          {group.actions.map(({ Icon, ...a }) => {
            const key = keyLabel(keys[a.binding]);
            const current = a.job !== undefined && !none && selected.every((c) => a.job!(jobOf(c)));
            const armed = a.action.type === 'mode' && hud.commandMode === a.action.mode;
            return (
              <button
                key={a.label}
                className={`${styles.button} ${current ? styles.current : ''} ${armed ? styles.armed : ''}`}
                disabled={none}
                title={`${a.hint} (${key})`}
                onClick={() => controls.runAction(a.action)}
              >
                <Icon className={styles.icon} size={18} strokeWidth={2} aria-hidden />
                <span className={styles.label}>{a.label}</span>
                <kbd className={styles.key}>{key}</kbd>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
