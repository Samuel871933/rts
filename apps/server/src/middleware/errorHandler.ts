import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';

/** Errors raised by express itself (malformed JSON, body too large...): the client's fault. */
const isClientError = (err: unknown): err is { status: number } =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as { status?: unknown }).status === 'number' &&
  (err as { status: number }).status >= 400 &&
  (err as { status: number }).status < 500;

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Données invalides', details: err.flatten().fieldErrors } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }
  if (isClientError(err)) {
    res.status(err.status).json({ error: { message: err.status === 413 ? 'Requête trop volumineuse' : 'Requête invalide' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Erreur interne du serveur' } });
};
