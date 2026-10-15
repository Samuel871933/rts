import { rateLimit } from 'express-rate-limit';
import type { AuthenticatedRequest } from './auth';

const message = (text: string) => ({ error: { message: text } });

/** Login: brute force / credential stuffing (bcrypt also runs on the same thread as the games). */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Trop de tentatives, réessaie dans quelques minutes'),
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Trop de comptes créés, réessaie plus tard'),
});

/** In-game calls (commands, clock): per account, generous for real play. Use after requireAuth. */
export const gameplayLimiter = rateLimit({
  windowMs: 10_000,
  limit: 150,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${(req as AuthenticatedRequest).userId}`,
  message: message('Trop d’actions envoyées, ralentis un peu'),
});
