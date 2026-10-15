import type { ChampionBehavior } from '@macrogod/shared';
import { useGameContext, useHud } from '../core/GameSessionContext';
import { LETTER_KEYS } from '../input/hotkeys';
import styles from './hud.module.css';

const BEHAVIORS: { key: keyof ChampionBehavior; label: string; hint: string; hotkey: string }[] = [
  { key: 'autoRetreat', label: 'Repli auto', hint: 'Rappel automatique sous 25 % de PV', hotkey: LETTER_KEYS.autoRetreat },
  { key: 'autoReturn', label: 'Retour en lane', hint: 'Après un rappel ou une mort, repart à son poste (si Farm auto est ON)', hotkey: LETTER_KEYS.autoReturn },
  { key: 'autoFarm', label: 'Farm auto', hint: 'ON : farme son poste tout seul et le reprend après une pause. OFF : arrête de farmer et n’agit que sur tes ordres', hotkey: LETTER_KEYS.autoFarm },
];

/** Bottom bar: how the champions play on their own (selection, or the whole team if none). */
export function BehaviorPanel() {
  const { controls, session } = useGameContext();
  const hud = useHud();
  const selected = hud.champions.filter((c) => hud.selection.includes(c.id));
  const targets = selected.length > 0 ? selected : hud.champions;

  return (
    <div className={`${styles.panel} ${styles.behaviorPanel}`}>
      <div className={styles.selectionInfo}>
        {selected.length > 0 ? (
          <>
            <strong>{selected.map((c) => c.name).join(', ')}</strong>
            <button className={styles.linkButton} onClick={() => controls.centerOnSelection()}>
              Centrer (Espace)
            </button>
          </>
        ) : (
          <span className={styles.muted}>
            Aucune sélection : les réglages s’appliquent à toute l’équipe. Clic gauche sur la carte = actions rapides, glisser un
            champion = l’envoyer.
          </span>
        )}
      </div>
      <div className={styles.behaviors}>
        <span className={styles.groupLabel}>Comportement</span>
        {BEHAVIORS.map((b) => {
          const on = targets.filter((c) => c[b.key]).length;
          const state = on === targets.length ? 'ON' : on === 0 ? 'OFF' : 'mixte';
          return (
            <button
              key={b.key}
              className={`${styles.toggle} ${state === 'ON' ? styles.toggleOn : state === 'mixte' ? styles.toggleMixed : ''}`}
              title={`${b.hint} (${b.hotkey.toUpperCase()})`}
              onClick={() => session.toggleBehavior(b.key)}
            >
              <span className={styles.toggleDot} />
              {b.label} <strong>{state}</strong>
              <kbd>{b.hotkey.toUpperCase()}</kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
