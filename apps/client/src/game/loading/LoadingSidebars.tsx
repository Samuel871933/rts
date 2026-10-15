import { DEFAULT_TIME_SCALE, GAME_SPEEDS, RULES, type BindingId, type Keybindings } from '@macrogod/shared';
import { keyLabel } from '../input/hotkeys';
import { useKeybindings } from '../input/useKeybindings';
import styles from './LoadingScreen.module.css';

/** Keys are given as binding ids (looked up in the player's map) or fixed labels. */
type KeyRef = BindingId | { fixed: string };
const label = (k: KeyRef, keys: Keybindings) => (typeof k === 'string' ? keyLabel(keys[k]) : k.fixed);
const fixed = (f: string): KeyRef => ({ fixed: f });

const CONTROLS: { keys: KeyRef[]; label: string }[] = [
  { keys: [fixed('1-5')], label: 'Sélectionner un champion' },
  { keys: [fixed('Tab')], label: 'Toute l’équipe' },
  { keys: [fixed('Clic droit')], label: 'Aller / attaquer (camps aussi dans le brouillard)' },
  { keys: [fixed('Clic gauche')], label: 'Menu rapide autour de la cible' },
  { keys: [fixed('Glisser')], label: 'Envoyer un champion vers une cible' },
  { keys: ['top', 'mid', 'bot'], label: 'Assigner top / mid / bot' },
  { keys: ['jungle'], label: 'Assigner la jungle' },
  { keys: ['attackMove'], label: 'Attaque-déplacement' },
  { keys: ['ward'], label: 'Poser une balise' },
  { keys: ['recall'], label: 'Rappel' },
  { keys: ['stop'], label: 'Stop' },
  { keys: ['pause'], label: 'Pause' },
  { keys: [fixed('Échap')], label: 'Fermer / désélectionner' },
];

const BEHAVIORS: { keys: KeyRef[]; label: string; detail: string }[] = [
  {
    keys: ['autoRetreat'],
    label: 'Repli auto',
    detail: `Rappel une fois sous ${Math.round(RULES.autoRetreatHpRatio * 100)} % PV, tes ordres suivants priment.`,
  },
  {
    keys: ['autoReturn'],
    label: 'Retour en lane',
    detail: 'Après un rappel ou une mort : repart à son poste (OFF : attend à la base).',
  },
  {
    keys: ['autoFarm'],
    label: 'Farm auto',
    detail: `Retourne à son poste ${RULES.autoFarmDelay} s après ton dernier ordre (compte à rebours au-dessus du champion).`,
  },
  {
    keys: ['autoTurretSafety'],
    label: 'Sécurité tour',
    detail: 'Quitte une tour ennemie dès qu’il n’y a plus de sbires pour encaisser ses tirs.',
  },
];

function Keys({ keys }: { keys: KeyRef[] }) {
  const bindings = useKeybindings();
  return (
    <span className={styles.keys}>
      {keys.map((k) => {
        const text = label(k, bindings);
        return <kbd key={text}>{text}</kbd>;
      })}
    </span>
  );
}

/** Left side of the loading screen: controls cheat sheet. */
export function ControlsPanel() {
  return (
    <aside className={styles.side}>
      <section className={styles.section}>
        <h2>Commandes</h2>
        <ul>
          {CONTROLS.map((c) => (
            <li key={c.label}>
              <Keys keys={c.keys} />
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

/** Right side of the loading screen: behaviour toggles and game rules worth remembering. */
export function SettingsPanel() {
  return (
    <aside className={styles.side}>
      <section className={styles.section} style={{ flexGrow: BEHAVIORS.length }}>
        <h2>Comportements</h2>
        <ul>
          {BEHAVIORS.map((b) => (
            <li key={b.label} className={styles.stacked}>
              <span className={styles.sideTitle}>
                <Keys keys={b.keys} /> {b.label}
              </span>
              <span className={styles.muted}>{b.detail}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section} style={{ flexGrow: 3 }}>
        <h2>Partie</h2>
        <ul>
          <li className={styles.stacked}>
            <span className={styles.sideTitle}>Vitesse x{DEFAULT_TIME_SCALE}</span>
            <span className={styles.muted}>
              Réglable en jeu ({GAME_SPEEDS.map((s) => `x${s}`).join(', ')}). La partie continue même page fermée.
            </span>
          </li>
          <li className={styles.stacked}>
            <span className={styles.sideTitle}>Objectifs</span>
            <span className={styles.muted}>Dragon et Nashor ne s’atteignent que par la rivière.</span>
          </li>
          <li className={styles.stacked}>
            <span className={styles.sideTitle}>Sbires et monstres</span>
            <span className={styles.muted}>Ne quittent jamais leur voie / leur camp.</span>
          </li>
        </ul>
      </section>
    </aside>
  );
}
