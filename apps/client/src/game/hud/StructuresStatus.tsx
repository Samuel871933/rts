import type { Team } from '@macrogod/shared';
import { LANE_LABELS, formatClock } from '../../i18n/labels';
import { useHud } from '../core/GameSessionContext';
import styles from './hud.module.css';

const TURRET_NAMES = ['extérieure', 'intérieure', "d'inhibiteur"];

/** Turrets / inhibitor per lane, plus the nexus: who is ahead in the siege at a glance. */
export function StructuresStatus({ team }: { team: Team }) {
  const structures = useHud((h) => h.structures);
  const s = structures[team];
  return (
    <div className={styles.structures}>
      {s.lanes.map((lane) => (
        <div key={lane.lane} className={styles.structureRow}>
          <span className={styles.structureLane}>{LANE_LABELS[lane.lane]}</span>
          {lane.turrets.map((alive, i) => (
            <span
              key={i}
              className={`${styles.turretPip} ${alive ? styles[`pip_${team}`] : styles.pipDown}`}
              title={`Tour ${TURRET_NAMES[i]} ${alive ? 'debout' : 'détruite'}`}
            />
          ))}
          <span
            className={`${styles.inhibPip} ${lane.inhibitor.alive ? styles[`pip_${team}`] : styles.pipDown}`}
            title={lane.inhibitor.alive ? 'Inhibiteur debout' : `Inhibiteur détruit, reconstruit dans ${formatClock(lane.inhibitor.respawnIn)}`}
          />
          {!lane.inhibitor.alive && <small>{formatClock(lane.inhibitor.respawnIn)}</small>}
        </div>
      ))}
      <div className={styles.structureRow}>
        <span className={styles.structureLane}>Nexus</span>
        {[0, 1].map((i) => (
          <span key={i} className={`${styles.turretPip} ${i < s.nexusTurrets ? styles[`pip_${team}`] : styles.pipDown}`} />
        ))}
        <span className={`${styles.nexusPip} ${s.nexus ? styles[`pip_${team}`] : styles.pipDown}`} />
      </div>
    </div>
  );
}
