import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '3 caractères minimum')
    .max(32, '32 caractères maximum')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Lettres, chiffres, _ . - uniquement'),
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum').max(128),
});

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Requis'),
  password: z.string().min(1, 'Requis'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
