import { SIM_TICK_RATE, clockTick, type MatchClock } from '@macrogod/shared';
import { Pause } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { useAsync } from '../../hooks/useAsync';
import { STATUS_LABELS, formatClock } from '../../i18n/labels';
import styles from './MatchHistory.module.css';

/** Running matches end on the server: refresh the list this often while one is in progress. */
const REFRESH_MS = 10_000;

/** Game time of a running match, ticking every second (it runs on, page open or not). */
function LiveClock({ clock }: { clock: MatchClock | null }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!clock || clock.paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clock]);
  if (!clock) return <span className={styles.meta}>0:00</span>;
  return (
    <span className={styles.meta} title={clock.paused ? 'En pause' : `En cours, vitesse x${clock.speed}`}>
      {clock.paused && <Pause size={12} className={styles.pausedIcon} />}
      {formatClock(clockTick(clock, now) / SIM_TICK_RATE)}
    </span>
  );
}

export function MatchHistory() {
  const { data: matches, error, loading, reload } = useAsync(() => matchesApi.list());
  const navigate = useNavigate();
  const hasRunning = matches?.some((m) => m.status === 'in_progress') ?? false;

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(reload, REFRESH_MS);
    return () => clearInterval(id);
  }, [hasRunning, reload]);

  if (loading && !matches) return <p className={styles.empty}>Chargement…</p>;
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
          {m.status === 'in_progress' ? (
            <span className={styles.running}>
              <LiveClock clock={m.clock} />
              <Button size="sm" onClick={() => navigate(`/game/${m.id}`)}>
                Reprendre
              </Button>
            </span>
          ) : (
            <span className={styles.meta}>{m.durationSec !== null ? formatClock(m.durationSec) : '—'}</span>
          )}
          <span className={styles.meta}>{new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </li>
      ))}
    </ul>
  );
}
