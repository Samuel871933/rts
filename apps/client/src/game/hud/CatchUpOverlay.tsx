import { useHud } from '../core/GameSessionContext';
import styles from './hud.module.css';

/** Covers the map while the game is rebuilt after time away (hidden tab, sleep...). */
export function CatchUpOverlay() {
  const catchUp = useHud((h) => h.catchUp);
  if (catchUp === null) return null;
  return <div className={styles.catchUpOverlay}>Reprise de la partie… {Math.floor(catchUp * 100)} %</div>;
}
