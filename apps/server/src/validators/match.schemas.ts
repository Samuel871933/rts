import { CAMPS, CHAMPIONS_BY_ID, GAME_SPEEDS, LANES, MAP_SIZE, ROLES, SIM_TICK_RATE, type Lane, type Role } from '@macrogod/shared';
import { z } from 'zod';

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

/**
 * The client can only give up: victories and defeats are recorded by the server's own simulation
 * (a client could otherwise claim any result).
 */
export const finishMatchSchema = z.object({
  status: z.literal('abandoned'),
});

/** Longest game the server accepts ticks for (6 h of game time). */
export const MAX_MATCH_TICKS = 6 * 3600 * SIM_TICK_RATE;

const coord = z.number().finite().min(0).max(MAP_SIZE);
const vec2 = z.object({ x: coord, y: coord });
const unitId = z.number().int().positive();

const orderSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('idle') }),
  z.object({ type: z.literal('move'), pos: vec2 }),
  z.object({ type: z.literal('attackMove'), pos: vec2 }),
  z.object({ type: z.literal('attack'), targetId: unitId }),
  z.object({ type: z.literal('camp'), campId: z.string().refine((id) => CAMPS.some((c) => c.id === id), 'Camp inconnu') }),
  z.object({ type: z.literal('lane'), lane: z.enum(LANES as [Lane, ...Lane[]]) }),
  z.object({ type: z.literal('jungle'), scope: z.enum(['own', 'enemy', 'all']) }),
  z.object({ type: z.literal('ward'), pos: vec2 }),
  z.object({ type: z.literal('follow'), targetId: unitId }),
  z.object({ type: z.literal('recall') }),
]);

const championIds = z.array(unitId).min(1).max(5);

export const commandSchema = z.object({
  tick: z.number().int().min(0).max(MAX_MATCH_TICKS),
  seq: z.number().int().min(0).max(2 ** 31 - 1),
  command: z.discriminatedUnion('type', [
    z.object({ type: z.literal('order'), championIds, order: orderSchema }),
    z.object({
      type: z.literal('behavior'),
      championIds,
      behavior: z
        .object({ autoRetreat: z.boolean(), autoReturn: z.boolean(), autoFarm: z.boolean(), autoTurretSafety: z.boolean() })
        .partial()
        .refine((b) => Object.keys(b).length > 0, 'Comportement vide'),
    }),
  ]),
});

/** Speed / pause only: the server computes where the game stands (the client can't jump in time). */
export const clockSchema = z.object({
  speed: z.number().refine((s) => (GAME_SPEEDS as readonly number[]).includes(s), 'Vitesse inconnue'),
  paused: z.boolean(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type FinishMatchInput = z.infer<typeof finishMatchSchema>;
export type CommandInput = z.infer<typeof commandSchema>;
export type ClockInput = z.infer<typeof clockSchema>;
