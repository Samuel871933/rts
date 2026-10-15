import { CHAMPIONS_BY_ID, getChampionIcon } from '@macrogod/shared';
import styles from './ChampionIcon.module.css';

interface ChampionIconProps {
  championId: string;
  size?: number;
  dimmed?: boolean;
  className?: string;
}

export function ChampionIcon({ championId, size = 40, dimmed, className }: ChampionIconProps) {
  const def = CHAMPIONS_BY_ID[championId];
  return (
    <span
      className={[styles.icon, dimmed && styles.dimmed, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={def?.name}
    >
      {def ? <img
          src={getChampionIcon(def)}
          alt={def.name}
          draggable={false}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        /> : '?'}
      <span className={styles.fallback}>{def?.name.slice(0, 2)}</span>
    </span>
  );
}
