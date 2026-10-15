import { BINDING_IDS, RESERVED_KEYS, type BindingId } from '@macrogod/shared';
import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '3 caractères minimum')
    .max(32, '32 caractères maximum')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Lettres, chiffres, _ . - uniquement'),
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z
    .string()
    .min(8, '8 caractères minimum')
    // bcrypt only uses the first 72 bytes: longer passwords would be silently truncated.
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, '72 octets maximum'),
});

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Requis').max(255),
  password: z.string().min(1, 'Requis').max(256),
});

const keySchema = z
  .string()
  .min(1)
  .max(12)
  .transform((k) => k.toLowerCase())
  .refine((k) => !RESERVED_KEYS.includes(k), 'Touche réservée');

export const settingsSchema = z.object({
  keybindings: z
    .record(z.enum(BINDING_IDS as unknown as [BindingId, ...BindingId[]]), keySchema)
    .refine((b) => new Set(Object.values(b)).size === Object.values(b).length, 'Une touche est utilisée deux fois')
    .optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
