import { resolveKeybindings, type BindingId, type Keybindings } from '@macrogod/shared';
import { useMemo } from 'react';
import { authApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';

/** The player's key map (account settings over the defaults). */
export function useKeybindings(): Keybindings {
  const settings = useAuthStore((s) => s.user?.settings);
  return useMemo(() => resolveKeybindings(settings), [settings]);
}

/** Same, outside React (keyboard handler). */
export const currentKeybindings = (): Keybindings => resolveKeybindings(useAuthStore.getState().user?.settings);

/** Saves a full key map on the account (optimistic: applied right away, reverted if refused). */
export async function saveKeybindings(next: Keybindings) {
  const { user, setUser } = useAuthStore.getState();
  if (!user) return;
  const previous = user.settings;
  setUser({ ...user, settings: { ...user.settings, keybindings: next } });
  try {
    setUser(await authApi.updateSettings({ keybindings: next }));
  } catch (err) {
    console.error('Réglages non enregistrés', err);
    setUser({ ...user, settings: previous });
    throw err;
  }
}

/** Assigns `key` to `id`; if another action had it, the two swap keys. */
export function rebind(bindings: Keybindings, id: BindingId, key: string): Keybindings {
  const next = { ...bindings };
  const other = (Object.keys(next) as BindingId[]).find((b) => b !== id && next[b] === key);
  if (other) next[other] = bindings[id];
  next[id] = key;
  return next;
}
