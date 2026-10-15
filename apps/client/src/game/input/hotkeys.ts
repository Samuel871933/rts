import type { BindingId, Keybindings, Lane } from '@macrogod/shared';
import type { CommandMode } from '../core/hudSnapshot';

export type HotkeyAction =
  | { type: 'selectIndex'; index: number }
  | { type: 'selectAll' }
  | { type: 'cancel' }
  | { type: 'mode'; mode: Exclude<CommandMode, 'none'> }
  | { type: 'lane'; lane: Lane }
  | { type: 'jungle' }
  | { type: 'recall' }
  | { type: 'stop' }
  | { type: 'autoRetreat' }
  | { type: 'autoReturn' }
  | { type: 'autoFarm' }
  | { type: 'autoTurretSafety' }
  | { type: 'pause' };

/** Fixed, position-based keys (KeyboardEvent.code): digits work on AZERTY without Shift. */
const BY_CODE: Record<string, HotkeyAction> = {
  Digit1: { type: 'selectIndex', index: 0 },
  Digit2: { type: 'selectIndex', index: 1 },
  Digit3: { type: 'selectIndex', index: 2 },
  Digit4: { type: 'selectIndex', index: 3 },
  Digit5: { type: 'selectIndex', index: 4 },
  Backquote: { type: 'selectAll' },
  Tab: { type: 'selectAll' },
  Escape: { type: 'cancel' },
};

/** What each rebindable key does. */
const BINDING_ACTIONS: Record<BindingId, HotkeyAction> = {
  attackMove: { type: 'mode', mode: 'attackMove' },
  ward: { type: 'mode', mode: 'ward' },
  recall: { type: 'recall' },
  stop: { type: 'stop' },
  top: { type: 'lane', lane: 'top' },
  mid: { type: 'lane', lane: 'mid' },
  bot: { type: 'lane', lane: 'bot' },
  jungle: { type: 'jungle' },
  autoRetreat: { type: 'autoRetreat' },
  autoReturn: { type: 'autoReturn' },
  autoFarm: { type: 'autoFarm' },
  autoTurretSafety: { type: 'autoTurretSafety' },
  pause: { type: 'pause' },
};

/** Rebindable keys go by KeyboardEvent.key, so the printed letter is the one pressed on any layout. */
export function hotkeyFor(e: KeyboardEvent, bindings: Keybindings): HotkeyAction | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  const fixed = BY_CODE[e.code];
  if (fixed) return fixed;
  const key = e.key.toLowerCase();
  const id = (Object.keys(bindings) as BindingId[]).find((b) => bindings[b] === key);
  return id ? BINDING_ACTIONS[id] : undefined;
}

/** How a bound key is printed on buttons and in the settings. */
export function keyLabel(key: string): string {
  if (key === ' ') return 'Espace';
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}
