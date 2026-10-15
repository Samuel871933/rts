import type { BindingId } from '@macrogod/shared';

/** How the rebindable actions are listed in the settings. */
export const BINDING_GROUPS: { title: string; items: { id: BindingId; label: string }[] }[] = [
  {
    title: 'Ordres',
    items: [
      { id: 'attackMove', label: 'Attaque-déplacement' },
      { id: 'ward', label: 'Poser une balise' },
      { id: 'recall', label: 'Rappel' },
      { id: 'stop', label: 'Stop (tenir la position)' },
    ],
  },
  {
    title: 'Assignation',
    items: [
      { id: 'top', label: 'Lane top' },
      { id: 'mid', label: 'Lane mid' },
      { id: 'bot', label: 'Lane bot' },
      { id: 'jungle', label: 'Jungle' },
    ],
  },
  {
    title: 'Comportements',
    items: [
      { id: 'autoRetreat', label: 'Repli auto' },
      { id: 'autoReturn', label: 'Retour en lane' },
      { id: 'autoFarm', label: 'Farm auto' },
      { id: 'autoTurretSafety', label: 'Sécurité tour' },
    ],
  },
  {
    title: 'Partie',
    items: [{ id: 'pause', label: 'Pause' }],
  },
];

export const BINDING_LABELS = Object.fromEntries(
  BINDING_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label])),
) as Record<BindingId, string>;
