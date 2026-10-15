/** Player-rebindable hotkeys (KeyboardEvent.key, lowercased: the printed letter on any layout). */
export const BINDING_IDS = [
  'attackMove',
  'ward',
  'recall',
  'stop',
  'top',
  'mid',
  'bot',
  'jungle',
  'autoRetreat',
  'autoReturn',
  'autoFarm',
  'autoTurretSafety',
  'pause',
] as const;
export type BindingId = (typeof BINDING_IDS)[number];
export type Keybindings = Record<BindingId, string>;

export const DEFAULT_KEYBINDINGS: Keybindings = {
  attackMove: 'a',
  ward: 'w',
  recall: 'b',
  stop: 's',
  top: 'z',
  mid: 'x',
  bot: 'c',
  jungle: 'j',
  autoRetreat: 'r',
  autoReturn: 'l',
  autoFarm: 'g',
  autoTurretSafety: 't',
  pause: 'p',
};

/** Keys kept for fixed controls (champion selection, select all, cancel). */
export const RESERVED_KEYS = ['1', '2', '3', '4', '5', 'tab', 'escape', ' '];

/** Saved on the player's account. */
export interface PlayerSettings {
  /** Only the keys the player changed. */
  keybindings?: Partial<Keybindings>;
}

/** Full key map: defaults overridden by the player's choices. */
export const resolveKeybindings = (settings: PlayerSettings | null | undefined): Keybindings => ({
  ...DEFAULT_KEYBINDINGS,
  ...settings?.keybindings,
});
