import type { Request, RequestHandler } from 'express';
import { verifyToken } from '../services/auth.service';
import { unauthorized } from '../utils/http';

export interface AuthenticatedRequest extends Request {
  userId: number;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    (req as AuthenticatedRequest).userId = verifyToken(header.slice(7)).sub;
    next();
  } catch {
    next(unauthorized('Session expirée, reconnecte-toi'));
  }
};
