import type { RefObject } from 'react';
import { ActionBar } from './ActionBar';
import { BehaviorPanel } from './BehaviorPanel';
import { CatchUpOverlay } from './CatchUpOverlay';
import { EndScreen } from './EndScreen';
import { EventFeed } from './EventFeed';
import { ModeHint } from './ModeHint';
import { RadialMenu } from './RadialMenu';
import { AllyPanel, EnemyPanel } from './TeamPanel';
import { TopBar } from './TopBar';
import styles from './hud.module.css';

interface GameLayoutProps {
  /** Element the Pixi canvas mounts into; it only covers the center column. */
  stageRef: RefObject<HTMLDivElement>;
  /** False until the renderer is up: panels need the game context. */
  ready: boolean;
  /** Back to the main menu, the match keeps running. */
  onLeave: () => void;
  /** Lose the match on purpose. */
  onSurrender: () => Promise<void>;
  onExit: () => void;
}

/** Allies | map | opponents. Nothing is drawn over the map except transient hints and the end screen. */
export function GameLayout({ stageRef, ready, onLeave, onSurrender, onExit }: GameLayoutProps) {
  return (
    <div className={styles.layout}>
      <aside className={styles.leftColumn}>{ready && <AllyPanel />}</aside>

      <section className={styles.centerColumn}>
        {ready && <TopBar onLeave={onLeave} onSurrender={onSurrender} />}
        <div className={styles.stageRow}>
          {ready && <ActionBar />}
          <div className={styles.stage}>
            <div ref={stageRef} className={styles.canvasHost} />
            {ready && (
              <>
                <ModeHint />
                <RadialMenu />
                <CatchUpOverlay />
              </>
            )}
          </div>
        </div>
        {ready && <BehaviorPanel />}
      </section>

      <aside className={styles.rightColumn}>
        {ready && (
          <>
            <EnemyPanel />
            <EventFeed />
          </>
        )}
      </aside>

      {ready && <EndScreen onExit={onExit} />}
    </div>
  );
}
