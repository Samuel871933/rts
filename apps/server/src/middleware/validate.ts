import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/** Parses req.body with the schema and replaces it with the typed, cleaned value. */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
