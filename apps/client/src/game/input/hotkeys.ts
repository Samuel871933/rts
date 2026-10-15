import type { Lane } from '@macrogod/shared';
import type { CommandMode } from '../core/hudSnapshot';

export type HotkeyAction =
  | { type: 'selectIndex'; index: number }
  | { type: 'selectAll' }
  | { type: 'center' }
  | { type: 'overview' }
  | { type: 'cancel' }
  | { type: 'mode'; mode: Exclude<CommandMode, 'none'> }
  | { type: 'lane'; lane: Lane }
  | { type: 'jungle' }
  | { type: 'recall' }
  | { type: 'stop' }
  | { type: 'autoRetreat' }
  | { type: 'autoReturn' }
  | { type: 'autoFarm' }
  | { type: 'pause' };

/** Position-based keys (KeyboardEvent.code): digits work on AZERTY without Shift. */
const BY_CODE: Record<string, HotkeyAction> = {
  Digit1: { type: 'selectIndex', index: 0 },
  Digit2: { type: 'selectIndex', index: 1 },
  Digit3: { type: 'selectIndex', index: 2 },
  Digit4: { type: 'selectIndex', index: 3 },
  Digit5: { type: 'selectIndex', index: 4 },
  Backquote: { type: 'selectAll' },
  Tab: { type: 'selectAll' },
  Space: { type: 'center' },
  Home: { type: 'overview' },
  Escape: { type: 'cancel' },
};

/** Letter keys (KeyboardEvent.key), so the printed letter is the one pressed on any layout. */
export const LETTER_KEYS = {
  attackMove: 'a',
  ward: 'w',
  top: 'z',
  mid: 'x',
  bot: 'c',
  jungle: 'j',
  recall: 'b',
  stop: 's',
  autoRetreat: 'r',
  autoReturn: 'l',
  autoFarm: 'g',
  pause: 'p',
  overview: 'f',
} as const;

const BY_KEY: Record<string, HotkeyAction> = {
  [LETTER_KEYS.attackMove]: { type: 'mode', mode: 'attackMove' },
  [LETTER_KEYS.ward]: { type: 'mode', mode: 'ward' },
  [LETTER_KEYS.top]: { type: 'lane', lane: 'top' },
  [LETTER_KEYS.mid]: { type: 'lane', lane: 'mid' },
  [LETTER_KEYS.bot]: { type: 'lane', lane: 'bot' },
  [LETTER_KEYS.jungle]: { type: 'jungle' },
  [LETTER_KEYS.recall]: { type: 'recall' },
  [LETTER_KEYS.stop]: { type: 'stop' },
  [LETTER_KEYS.autoRetreat]: { type: 'autoRetreat' },
  [LETTER_KEYS.autoReturn]: { type: 'autoReturn' },
  [LETTER_KEYS.autoFarm]: { type: 'autoFarm' },
  [LETTER_KEYS.pause]: { type: 'pause' },
  [LETTER_KEYS.overview]: { type: 'overview' },
};

export function hotkeyFor(e: KeyboardEvent): HotkeyAction | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  return BY_CODE[e.code] ?? BY_KEY[e.key.toLowerCase()];
}
