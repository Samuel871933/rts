import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { championsApi, matchesApi } from '../api/endpoints';
import { Button } from '../components/ui/Button';
import { ChampionDetails } from '../features/champion-select/ChampionDetails';
import styles from '../features/champion-select/ChampionSelect.module.css';
import { ChampionTile } from '../features/champion-select/ChampionTile';
import { RoleSlots } from '../features/champion-select/RoleSlots';
import { useTeamBuilder } from '../features/champion-select/useTeamBuilder';
import { useAsync } from '../hooks/useAsync';

export function ChampionSelectPage() {
  const { data: champions, error, loading } = useAsync(() => championsApi.list());
  const team = useTeamBuilder(champions ?? []);
  const [hovered, setHovered] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function start() {
    if (!team.composition) return;
    setStarting(true);
    setStartError(null);
    try {
      const match = await matchesApi.create(team.composition);
      navigate(`/game/${match.id}`);
    } catch (err) {
      setStartError((err as Error).message);
      setStarting(false);
    }
  }

  if (loading) return <p>Chargement des champions…</p>;
  if (error || !champions) return <p className={styles.error}>{error}</p>;

  const detail = champions.find((c) => c.id === hovered) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Compose ton équipe</h1>
          <p className={styles.hint}>
            Choisis un rôle puis un champion. Le jungler reçoit Châtiment et un compagnon de jungle.
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={team.randomize}>
            Aléatoire
          </Button>
          <Button size="lg" disabled={!team.composition} loading={starting} onClick={start}>
            Lancer la partie
          </Button>
        </div>
      </header>
      {startError && <p className={styles.error}>{startError}</p>}

      <RoleSlots slots={team.slots} activeRole={team.activeRole} onSelectRole={team.setActiveRole} onClear={team.clear} />

      <div className={styles.body}>
        <div className={styles.grid}>
          {champions.map((c) => (
            <ChampionTile key={c.id} champion={c} pickedAs={team.roleOf(c.id)} onPick={team.pick} onHover={setHovered} />
          ))}
        </div>
        <ChampionDetails champion={detail} />
      </div>
    </div>
  );
}
