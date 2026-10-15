import { GAME_SPEEDS } from '@macrogod/shared';
import { Castle, Flame, Pause, Play, Settings, Worm } from 'lucide-react';
import { useState } from 'react';
import { formatClock } from '../../i18n/labels';
import type { ObjectiveStatus } from '../core/hudSnapshot';
import { useGameContext, useHud } from '../core/GameSessionContext';
import { keyLabel } from '../input/hotkeys';
import { useKeybindings } from '../input/useKeybindings';
import { SettingsModal } from '../settings/SettingsModal';
import styles from './TopBar.module.css';

function Objective({ name, status, time }: { name: string; status: ObjectiveStatus; time: number }) {
  const label = status.alive ? 'Disponible' : status.spawnAt !== null ? formatClock(status.spawnAt - time) : '—';
  return (
    <span className={`${styles.objective} ${status.alive ? styles.objectiveUp : ''}`}>
      <strong>{name}</strong> {label}
    </span>
  );
}

interface TopBarProps {
  onLeave: () => void;
  onSurrender: () => Promise<void>;
}

export function TopBar({ onLeave, onSurrender }: TopBarProps) {
  const { session } = useGameContext();
  const hud = useHud();
  const keys = useKeybindings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const blue = hud.teams.blue;

  return (
    <div className={styles.bar}>
      <div className={styles.speeds}>
        <button
          className={`${styles.speed} ${hud.paused ? styles.active : ''}`}
          onClick={() => session.togglePause()}
          title={`${hud.paused ? 'Reprendre' : 'Pause'} (${keyLabel(keys.pause)})`}
          aria-label={hud.paused ? 'Reprendre' : 'Pause'}
        >
          {hud.paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
        </button>
        {GAME_SPEEDS.map((s) => (
          <button
            key={s}
            className={`${styles.speed} ${!hud.paused && hud.speed === s ? styles.active : ''}`}
            onClick={() => session.setSpeed(s)}
          >
            x{s}
          </button>
        ))}
      </div>

      <div className={styles.clock}>{formatClock(hud.time)}</div>

      <div className={styles.scores}>
        <span title="Structures ennemies détruites">
          <Castle size={15} /> {blue.structuresDestroyed}
        </span>
        <span title="Dragons">
          <Flame size={15} /> {blue.dragons}
        </span>
        <span title="Nashor">
          <Worm size={15} /> {blue.barons}
        </span>
      </div>

      <div className={styles.objectives}>
        <Objective name="Dragon" status={hud.objectives.dragon} time={hud.time} />
        <Objective name="Nashor" status={hud.objectives.baron} time={hud.time} />
      </div>

      <button className={styles.settings} onClick={() => setSettingsOpen(true)} title="Réglages" aria-label="Réglages">
        <Settings size={17} />
      </button>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onLeave={onLeave} onSurrender={onSurrender} />}
    </div>
  );
}
