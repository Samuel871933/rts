import { CHAMPIONS_BY_ID, ROLES, type Role } from '@macrogod/shared';
import { z } from 'zod';
import { MATCH_STATUSES } from '../models/Match';

const pickSchema = z.object({
  championId: z.string().refine((id) => id in CHAMPIONS_BY_ID, 'Champion inconnu'),
  role: z.enum(ROLES as [Role, ...Role[]]),
});

export const createMatchSchema = z.object({
  composition: z
    .array(pickSchema)
    .length(5, 'Il faut exactement 5 champions')
    .refine((picks) => new Set(picks.map((p) => p.championId)).size === 5, 'Champions en double')
    .refine((picks) => new Set(picks.map((p) => p.role)).size === 5, 'Chaque rôle doit être pris une fois'),
});

export const finishMatchSchema = z.object({
  status: z.enum(MATCH_STATUSES).exclude(['in_progress']),
  durationSec: z.number().int().min(0),
  stats: z
    .array(
      z.object({
        championId: z.string(),
        level: z.number().int(),
        kills: z.number().int(),
        deaths: z.number().int(),
        cs: z.number().int(),
        gold: z.number().int(),
      }),
    )
    .max(5)
    .optional(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type FinishMatchInput = z.infer<typeof finishMatchSchema>;
