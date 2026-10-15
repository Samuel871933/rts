import { createContext, useContext, useSyncExternalStore } from 'react';
import type { InputController } from '../input/InputController';
import type { GameRenderer } from '../render/GameRenderer';
import type { GameSession } from './GameSession';
import type { HudSnapshot } from './hudSnapshot';

export interface GameContextValue {
  session: GameSession;
  renderer: GameRenderer;
  controls: InputController;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGameContext must be used inside <GameContext.Provider>');
  return value;
}

/** HUD state, refreshed ~10 times per second and right after each player action. */
export function useHud(): HudSnapshot {
  const { session } = useGameContext();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}
