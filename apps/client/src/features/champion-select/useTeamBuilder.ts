import { ROLES, randomComposition, type ChampionDef, type ChampionPick, type Role } from '@macrogod/shared';
import { useCallback, useMemo, useState } from 'react';

type Slots = Record<Role, string | null>;

const emptySlots = (): Slots => ({ top: null, jungle: null, mid: null, bot: null, support: null });

/** Team composition state: one champion per role, with an "active" slot that the next pick fills. */
export function useTeamBuilder(champions: ChampionDef[]) {
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [activeRole, setActiveRole] = useState<Role | null>('top');

  const roleOf = useCallback(
    (championId: string) => ROLES.find((r) => slots[r] === championId) ?? null,
    [slots],
  );

  const pick = useCallback(
    (championId: string) => {
      const current = roleOf(championId);
      if (current) {
        // Clicking a picked champion again frees its slot.
        setSlots((s) => ({ ...s, [current]: null }));
        setActiveRole(current);
        return;
      }
      const def = champions.find((c) => c.id === championId);
      const target =
        activeRole ??
        def?.roles.find((r) => !slots[r]) ??
        ROLES.find((r) => !slots[r]) ??
        null;
      if (!target) return;
      const next = { ...slots, [target]: championId };
      setSlots(next);
      setActiveRole(ROLES.find((r) => !next[r]) ?? null);
    },
    [activeRole, champions, roleOf, slots],
  );

  const clear = useCallback((role: Role) => {
    setSlots((s) => ({ ...s, [role]: null }));
    setActiveRole(role);
  }, []);

  /** Fills empty slots, preferring champions whose recommended roles match. */
  const randomize = useCallback(() => {
    const next = emptySlots();
    for (const pick of randomComposition(champions)) next[pick.role] = pick.championId;
    setSlots(next);
    setActiveRole(null);
  }, [champions]);

  const composition = useMemo<ChampionPick[] | null>(() => {
    if (ROLES.some((r) => !slots[r])) return null;
    return ROLES.map((role) => ({ role, championId: slots[role]! }));
  }, [slots]);

  return { slots, activeRole, setActiveRole, pick, clear, randomize, roleOf, composition };
}
