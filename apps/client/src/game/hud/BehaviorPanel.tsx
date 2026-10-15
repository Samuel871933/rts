import { CHAMPIONS_BY_ID, RULES, type BindingId, type ChampionBehavior } from '@macrogod/shared';
import { Castle, HeartPulse, Undo2, Wheat, type LucideIcon } from 'lucide-react';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { useGameContext, useHud } from '../core/GameSessionContext';
import { keyLabel } from '../input/hotkeys';
import { useKeybindings } from '../input/useKeybindings';
import styles from './BehaviorPanel.module.css';

interface BehaviorDef {
  key: keyof ChampionBehavior;
  Icon: LucideIcon;
  label: string;
  /** One line under the label, always visible. */
  summary: string;
  /** Full explanation (tooltip). */
  hint: string;
  binding: BindingId;
}

const BEHAVIORS: BehaviorDef[] = [
  {
    key: 'autoRetreat',
    Icon: HeartPulse,
    label: 'Repli auto',
    summary: `Rappel sous ${Math.round(RULES.autoRetreatHpRatio * 100)} % PV`,
    hint: `Lance un rappel quand les PV passent sous ${Math.round(RULES.autoRetreatHpRatio * 100)} % (une fois : tes ordres suivants sont respectés)`,
    binding: 'autoRetreat',
  },
  {
    key: 'autoReturn',
    Icon: Undo2,
    label: 'Retour en lane',
    summary: 'Après rappel / mort',
    hint: 'ON : après un rappel ou une mort, repart aussitôt à son poste. OFF : attend tes ordres à la base',
    binding: 'autoReturn',
  },
  {
    key: 'autoFarm',
    Icon: Wheat,
    label: 'Farm auto',
    summary: `Reprend son poste après ${RULES.autoFarmDelay} s`,
    hint: `ON : farme son poste et y retourne ${RULES.autoFarmDelay} s après la fin de ton dernier ordre (compte à rebours au-dessus du champion). OFF : n’agit que sur tes ordres`,
    binding: 'autoFarm',
  },
  {
    key: 'autoTurretSafety',
    Icon: Castle,
    label: 'Sécurité tour',
    summary: 'Quitte la tour sans sbires',
    hint: 'ON : en attaquant sous une tour ennemie, le champion en sort dès qu’il n’y a plus de sbires alliés pour encaisser (ou qu’elle le vise), puis reprend son poste',
    binding: 'autoTurretSafety',
  },
];

type ToggleState = 'on' | 'off' | 'mixed';

/** Bottom bar: how the champions play on their own (selection, or the whole team if none). */
export function BehaviorPanel() {
  const { session } = useGameContext();
  const hud = useHud((h) => ({ champions: h.champions, selection: h.selection }));
  const keys = useKeybindings();
  const selected = hud.champions.filter((c) => hud.selection.includes(c.id));
  const targets = selected.length > 0 ? selected : hud.champions;

  return (
    <div className={styles.bar}>
      <div className={styles.scope}>
        <span className={styles.scopeLabel}>Réglages pour</span>
        <div className={styles.scopeTargets}>
          {selected.length > 0 ? (
            <>
              <span className={styles.portraits}>
                {selected.map((c) => (
                  <ChampionIcon key={c.id} championId={c.defId} size={22} />
                ))}
              </span>
              <strong>{selected.length === 1 ? CHAMPIONS_BY_ID[selected[0].defId].name : `${selected.length} champions`}</strong>
            </>
          ) : (
            <strong>Toute l’équipe</strong>
          )}
        </div>
      </div>

      <div className={styles.toggles}>
        {BEHAVIORS.map(({ Icon, ...b }) => {
          const on = targets.filter((c) => c[b.key]).length;
          const key = keyLabel(keys[b.binding]);
          const state: ToggleState = on === targets.length ? 'on' : on === 0 ? 'off' : 'mixed';
          return (
            <button
              key={b.key}
              className={`${styles.tile} ${styles[state]}`}
              title={`${b.hint} (${key})`}
              aria-pressed={state === 'on'}
              onClick={() => session.toggleBehavior(b.key)}
            >
              <span className={styles.icon}>
                <Icon size={15} strokeWidth={2.2} aria-hidden />
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{b.label}</span>
                <span className={styles.summary}>{b.summary}</span>
              </span>
              <span className={styles.switch}>
                <i />
              </span>
              <kbd className={styles.key}>{key}</kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
