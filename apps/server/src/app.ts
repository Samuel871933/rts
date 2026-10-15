import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { notFound } from './utils/http';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);
  app.use((_req, _res, next) => next(notFound('Route introuvable')));
  app.use(errorHandler);
  return app;
}
