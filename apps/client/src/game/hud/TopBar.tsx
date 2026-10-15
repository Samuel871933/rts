import { GAME_SPEEDS } from '@macrogod/shared';
import { formatClock } from '../../i18n/labels';
import type { ObjectiveStatus } from '../core/hudSnapshot';
import { useGameContext, useHud } from '../core/GameSessionContext';
import { LETTER_KEYS } from '../input/hotkeys';
import styles from './hud.module.css';

function Objective({ name, status, time }: { name: string; status: ObjectiveStatus; time: number }) {
  const label = status.alive ? 'Disponible' : status.spawnAt !== null ? formatClock(status.spawnAt - time) : '—';
  return (
    <span className={`${styles.objective} ${status.alive ? styles.objectiveUp : ''}`}>
      <strong>{name}</strong> {label}
    </span>
  );
}

export function TopBar({ onQuit }: { onQuit: () => void }) {
  const { session, renderer } = useGameContext();
  const hud = useHud();
  const blue = hud.teams.blue;

  return (
    <div className={`${styles.panel} ${styles.topBar}`}>
      <div className={styles.speeds}>
        <button
          className={hud.paused ? styles.active : ''}
          onClick={() => session.togglePause()}
          title={`Pause (${LETTER_KEYS.pause.toUpperCase()})`}
        >
          ❚❚
        </button>
        {GAME_SPEEDS.map((s) => (
          <button key={s} className={!hud.paused && hud.speed === s ? styles.active : ''} onClick={() => session.setSpeed(s)}>
            x{s}
          </button>
        ))}
      </div>

      <div className={styles.clock}>{formatClock(hud.time)}</div>

      <div className={styles.scores}>
        <span title="Structures ennemies détruites">🏰 {blue.structuresDestroyed}</span>
        <span title="Dragons">🐉 {blue.dragons}</span>
        <span title="Nashor">👁 {blue.barons}</span>
      </div>

      <div className={styles.objectives}>
        <Objective name="Dragon" status={hud.objectives.dragon} time={hud.time} />
        <Objective name="Nashor" status={hud.objectives.baron} time={hud.time} />
      </div>

      <button
        className={styles.overview}
        onClick={() => renderer.camera.fitMap()}
        title={`Recentrer sur toute la carte (${LETTER_KEYS.overview.toUpperCase()} ou Origine)`}
      >
        Vue globale <kbd>{LETTER_KEYS.overview.toUpperCase()}</kbd>
      </button>

      <button className={styles.quit} onClick={onQuit}>
        Abandonner
      </button>
    </div>
  );
}
