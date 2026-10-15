import type { Request, RequestHandler } from 'express';
import { verifyToken } from '../services/auth.service';
import { unauthorized } from '../utils/http';

export interface AuthenticatedRequest extends Request {
  userId: number;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
  if (!token) return next(unauthorized());
  try {
    (req as AuthenticatedRequest).userId = verifyToken(token).sub;
    next();
  } catch {
    next(unauthorized('Session expirée, reconnecte-toi'));
  }
};
