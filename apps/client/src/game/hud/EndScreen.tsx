import { Button } from '../../components/ui/Button';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { formatClock } from '../../i18n/labels';
import { useGameContext, useHud } from '../core/GameSessionContext';
import styles from './hud.module.css';

export function EndScreen({ onExit }: { onExit: () => void }) {
  const { session } = useGameContext();
  const hud = useHud((h) => (h.winner ? h : null));
  if (!hud?.winner) return null;
  const won = hud.winner === session.team;

  return (
    <div className={styles.endOverlay}>
      <div className={styles.endCard}>
        <h1 className={won ? styles.victory : styles.defeat}>{won ? 'Victoire' : 'Défaite'}</h1>
        <p className={styles.muted}>Durée de jeu : {formatClock(hud.time)}</p>
        <table className={styles.endTable}>
          <thead>
            <tr>
              <th />
              <th>Niv.</th>
              <th>K / M</th>
              <th>Sbires</th>
              <th>Or</th>
            </tr>
          </thead>
          <tbody>
            {hud.champions.map((c) => (
              <tr key={c.id}>
                <td>
                  <ChampionIcon championId={c.defId} size={28} /> {c.name}
                </td>
                <td>{c.level}</td>
                <td>
                  {c.kills} / {c.deaths}
                </td>
                <td>{c.cs}</td>
                <td>{Math.floor(c.gold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button size="lg" onClick={onExit}>
          Retour à l’accueil
        </Button>
      </div>
    </div>
  );
}
