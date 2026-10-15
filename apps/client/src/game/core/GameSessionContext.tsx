import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';
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

/** Same keys, same values (by identity): the snapshot keeps unchanged parts' identity. */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * HUD state, refreshed ~10 times per second and right after each player action.
 * With a selector, the component only re-renders when the selected part changes (shallow compare):
 * `useHud((h) => h.radial)`, `useHud((h) => ({ feed: h.feed, time: h.time }))`...
 */
export function useHud(): HudSnapshot;
export function useHud<T>(select: (hud: HudSnapshot) => T): T;
export function useHud<T>(select?: (hud: HudSnapshot) => T): T | HudSnapshot {
  const { session } = useGameContext();
  const cache = useRef<{ snapshot: HudSnapshot; value: unknown } | null>(null);
  const selectRef = useRef(select);
  selectRef.current = select;

  const getSelected = useCallback(() => {
    const snapshot = session.getSnapshot();
    const pick = selectRef.current;
    if (!pick) return snapshot;
    const last = cache.current;
    if (last?.snapshot === snapshot) return last.value;
    const value = pick(snapshot);
    if (last && shallowEqual(last.value, value)) {
      cache.current = { snapshot, value: last.value };
      return last.value;
    }
    cache.current = { snapshot, value };
    return value;
  }, [session]);

  return useSyncExternalStore(session.subscribe, getSelected) as T | HudSnapshot;
}
