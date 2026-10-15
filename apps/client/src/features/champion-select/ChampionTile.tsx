import type { ChampionDef, Role } from '@macrogod/shared';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { ARCHETYPE_LABELS, ROLE_LABELS } from '../../i18n/labels';
import styles from './ChampionSelect.module.css';

interface ChampionTileProps {
  champion: ChampionDef;
  pickedAs: Role | null;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function ChampionTile({ champion, pickedAs, onPick, onHover }: ChampionTileProps) {
  return (
    <button
      className={`${styles.tile} ${pickedAs ? styles.picked : ''}`}
      onClick={() => onPick(champion.id)}
      onMouseEnter={() => onHover(champion.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(champion.id)}
    >
      <ChampionIcon championId={champion.id} size={64} dimmed={!!pickedAs} />
      <span className={styles.tileName}>{champion.name}</span>
      <span className={styles.tileMeta}>{ARCHETYPE_LABELS[champion.archetype]}</span>
      {pickedAs && <span className={styles.badge}>{ROLE_LABELS[pickedAs]}</span>}
    </button>
  );
}
