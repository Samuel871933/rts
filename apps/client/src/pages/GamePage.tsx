import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { matchesApi } from '../api/endpoints';
import type { Match, MatchChampionStats } from '../api/types';
import { Button } from '../components/ui/Button';
import { GameSession } from '../game/core/GameSession';
import { GameContext, type GameContextValue } from '../game/core/GameSessionContext';
import { GameLayout } from '../game/hud/GameLayout';
import { InputController } from '../game/input/InputController';
import { GameRenderer } from '../game/render/GameRenderer';
import { useAsync } from '../hooks/useAsync';
import styles from './GamePage.module.css';

function championStats(session: GameSession): MatchChampionStats[] {
  return session.myChampions().map((c) => ({
    championId: c.defId,
    level: c.level,
    kills: c.stats.kills,
    deaths: c.stats.deaths,
    cs: c.stats.cs,
    gold: Math.floor(c.totalGold),
  }));
}

function GameView({ match }: { match: Match }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<GameContextValue | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const reported = useRef(false);
  const navigate = useNavigate();

  const report = useCallback(
    (session: GameSession, status: 'victory' | 'defeat' | 'abandoned') => {
      if (reported.current) return Promise.resolve();
      reported.current = true;
      return matchesApi
        .finish(match.id, { status, durationSec: Math.floor(session.game.state.time), stats: championStats(session) })
        .then(() => undefined)
        .catch((err) => console.error('Résultat non enregistré', err));
    },
    [match.id],
  );

  useEffect(() => {
    const session = new GameSession({ seed: match.seed, teams: { blue: match.composition, red: match.enemyComposition ?? [] } });
    let renderer: GameRenderer | null = null;
    let controls: InputController | null = null;
    let disposed = false;

    const offEvents = session.onEvents((events) => {
      const victory = events.find((e) => e.type === 'victory');
      if (victory?.type === 'victory') report(session, victory.winner === session.team ? 'victory' : 'defeat');
    });

    GameRenderer.create(hostRef.current!, session).then((r) => {
      if (disposed) return r.destroy();
      renderer = r;
      controls = new InputController(r, session);
      session.start();
      const value = { session, renderer: r, controls };
      if (import.meta.env.DEV) Object.assign(window, { __macrogod: value });
      setCtx(value);
    })
      .catch((err: Error) => {
        console.error(err);
        setInitError('Impossible de démarrer le rendu (WebGL indisponible ?)');
      });

    return () => {
      disposed = true;
      offEvents();
      session.stop();
      controls?.destroy();
      renderer?.destroy();
    };
  }, [match, report]);

  const quit = async () => {
    if (!ctx || !window.confirm('Abandonner la partie ?')) return;
    ctx.session.stop();
    await report(ctx.session, 'abandoned');
    navigate('/', { replace: true });
  };

  return (
    <GameContext.Provider value={ctx}>
      <GameLayout
        stageRef={hostRef}
        ready={ctx !== null}
        status={initError ?? 'Chargement de la Faille…'}
        onQuit={quit}
        onExit={() => navigate('/', { replace: true })}
      />
    </GameContext.Provider>
  );
}

export function GamePage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { data: match, error, loading } = useAsync(() => matchesApi.get(matchId!), [matchId]);

  if (loading) return <div className={styles.loading}>Chargement…</div>;
  if (error || !match) {
    return (
      <div className={styles.message}>
        <p>{error ?? 'Partie introuvable'}</p>
        <Button onClick={() => navigate('/')}>Retour</Button>
      </div>
    );
  }
  if (match.status !== 'in_progress') {
    return (
      <div className={styles.message}>
        <p>Cette partie est terminée.</p>
        <Button onClick={() => navigate('/')}>Retour à l’accueil</Button>
      </div>
    );
  }
  return <GameView match={match} />;
}
