import { useHud } from '../core/GameSessionContext';
import styles from './hud.module.css';

const HINTS = {
  ward: 'Clic gauche pour poser une balise · clic droit / Échap pour annuler',
  attackMove: 'Clic gauche pour attaquer-déplacer · clic droit / Échap pour annuler',
} as const;

export function ModeHint() {
  const { commandMode, paused } = useHud((h) => ({ commandMode: h.commandMode, paused: h.paused }));
  if (commandMode === 'none' && !paused) return null;
  return (
    <div className={styles.modeHint}>
      {paused && <strong>PAUSE — tu peux toujours donner des ordres. </strong>}
      {commandMode !== 'none' && HINTS[commandMode]}
    </div>
  );
}
