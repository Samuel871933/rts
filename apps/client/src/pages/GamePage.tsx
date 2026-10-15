import { DEFAULT_TIME_SCALE, type MatchClock } from '@macrogod/shared';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { matchesApi } from '../api/endpoints';
import type { Match, MatchLog } from '../api/types';
import { Button } from '../components/ui/Button';
import { GameSession } from '../game/core/GameSession';
import { GameContext, type GameContextValue } from '../game/core/GameSessionContext';
import { MatchSync, clearOutbox, mergeWithOutbox } from '../game/core/MatchSync';
import { LoadingScreen } from '../game/loading/LoadingScreen';
import { useAuthStore } from '../store/authStore';
import { GameLayout } from '../game/hud/GameLayout';
import { InputController } from '../game/input/InputController';
import { GameRenderer } from '../game/render/GameRenderer';
import { useAsync } from '../hooks/useAsync';
import styles from './GamePage.module.css';

/**
 * Builds the session from the saved log (plus what this browser had not saved yet);
 * a match opened for the first time starts its clock now.
 */
function createSession(match: Match, log: MatchLog): GameSession {
  const { clock: savedClock, commands } = mergeWithOutbox(match.id, log);
  const sync = new MatchSync(match.id, commands);
  sync.resendPending();
  let clock: MatchClock | null = savedClock;
  if (!clock) {
    clock = { tick: 0, at: log.serverNow, speed: DEFAULT_TIME_SCALE, paused: false };
    sync.clock(clock);
  }
  return new GameSession({
    setup: { seed: match.seed, teams: { blue: match.composition, red: match.enemyComposition ?? [] } },
    clock,
    serverOffsetMs: log.serverNow - Date.now(),
    log: commands,
    sync,
  });
}

/** The loading screen stays up at least this long, so it doesn't just flash on a fresh game. */
const MIN_LOADING_MS = 1500;
/** Share of the loading bar for rebuilding the game; the rest is the renderer. */
const CATCH_UP_SHARE = 0.85;

interface LoadingState {
  status: string;
  progress: number;
  done: boolean;
}

function GameView({ match, log }: { match: Match; log: MatchLog }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<GameContextValue | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ status: 'Chargement de la Faille…', progress: 0, done: false });
  const playerName = useAuthStore((s) => s.user?.username ?? 'Toi');
  const navigate = useNavigate();

  useEffect(() => {
    const session = createSession(match, log);
    let renderer: GameRenderer | null = null;
    let controls: InputController | null = null;
    let disposed = false;

    // The server records the result from its own simulation; here the match is just over.
    const offEvents = session.onEvents((events) => {
      if (events.some((e) => e.type === 'victory')) clearOutbox(match.id);
    });

    const init = async () => {
      const startedAt = performance.now();
      const resuming = log.commands.length > 0 || (log.clock?.tick ?? 0) > 0;
      await session.catchUp((ratio) =>
        setLoading({ status: resuming ? 'Reprise de la partie…' : 'Chargement de la Faille…', progress: ratio * CATCH_UP_SHARE, done: false }),
      );
      if (disposed) return;
      setLoading({ status: 'Chargement de la Faille…', progress: CATCH_UP_SHARE, done: false });
      const r = await GameRenderer.create(hostRef.current!, session).catch((err: Error) => {
        console.error(err);
        setLoading({ status: 'Impossible de démarrer le rendu (WebGL indisponible ?)', progress: CATCH_UP_SHARE, done: false });
        return null;
      });
      if (!r) return;
      if (disposed) return r.destroy();
      renderer = r;
      controls = new InputController(r, session);
      session.start();
      const value = { session, renderer: r, controls };
      if (import.meta.env.DEV) Object.assign(window, { __macrogod: value });
      setCtx(value);
      setLoading({ status: 'Prêt', progress: 1, done: false });
      const wait = MIN_LOADING_MS - (performance.now() - startedAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (!disposed) setLoading((l) => ({ ...l, done: true }));
    };
    void init();

    return () => {
      disposed = true;
      offEvents();
      session.stop();
      controls?.destroy();
      renderer?.destroy();
    };
  }, [match, log]);

  /** The match goes on in real time (server-side): the player can resume it from the home page. */
  const leave = () => navigate('/', { replace: true });

  const surrender = async () => {
    if (!ctx) return;
    ctx.session.stop();
    await matchesApi.abandon(match.id).catch((err) => console.error('Abandon non enregistré', err));
    clearOutbox(match.id);
    navigate('/', { replace: true });
  };

  return (
    <GameContext.Provider value={ctx}>
      <GameLayout
        stageRef={hostRef}
        ready={ctx !== null}
        onLeave={leave}
        onSurrender={surrender}
        onExit={() => navigate('/', { replace: true })}
      />
      {!loading.done && (
        <LoadingScreen
          allies={match.composition}
          enemies={match.enemyComposition ?? []}
          playerName={playerName}
          progress={loading.progress}
          status={loading.status}
        />
      )}
    </GameContext.Provider>
  );
}

export function GamePage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(
    () => Promise.all([matchesApi.get(matchId!), matchesApi.log(matchId!)]),
    [matchId],
  );
  const [match, log] = data ?? [];

  if (loading) return <div className={styles.loading}>Chargement…</div>;
  if (error || !match || !log) {
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
  return <GameView match={match} log={log} />;
}
