import { matchesApi } from '../../api/endpoints';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { useAsync } from '../../hooks/useAsync';
import { STATUS_LABELS, formatClock } from '../../i18n/labels';
import styles from './MatchHistory.module.css';

export function MatchHistory() {
  const { data: matches, error, loading } = useAsync(() => matchesApi.list());

  if (loading) return <p className={styles.empty}>Chargement…</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!matches?.length) return <p className={styles.empty}>Aucune partie pour l’instant. Lance ta première !</p>;

  return (
    <ul className={styles.list}>
      {matches.map((m) => (
        <li key={m.id} className={styles.row}>
          <span className={`${styles.status} ${styles[m.status]}`}>{STATUS_LABELS[m.status]}</span>
          <span className={styles.team}>
            {m.composition.map((p) => (
              <ChampionIcon key={p.championId} championId={p.championId} size={30} />
            ))}
            {m.enemyComposition && (
              <>
                <span className={styles.versus}>vs</span>
                {m.enemyComposition.map((p) => (
                  <ChampionIcon key={p.championId} championId={p.championId} size={30} />
                ))}
              </>
            )}
          </span>
          <span className={styles.meta}>{m.durationSec !== null ? formatClock(m.durationSec) : '—'}</span>
          <span className={styles.meta}>{new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </li>
      ))}
    </ul>
  );
}
