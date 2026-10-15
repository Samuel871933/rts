import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { listChampions } from '../controllers/champion.controller';
import * as matches from '../controllers/match.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/auth.schemas';
import { createMatchSchema, finishMatchSchema } from '../validators/match.schemas';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

apiRouter.post('/auth/register', validateBody(registerSchema), auth.register);
apiRouter.post('/auth/login', validateBody(loginSchema), auth.login);
apiRouter.get('/auth/me', requireAuth, auth.me);

apiRouter.get('/champions', requireAuth, listChampions);

apiRouter.get('/matches', requireAuth, matches.list);
apiRouter.post('/matches', requireAuth, validateBody(createMatchSchema), matches.create);
apiRouter.get('/matches/:id', requireAuth, matches.show);
apiRouter.patch('/matches/:id/finish', requireAuth, validateBody(finishMatchSchema), matches.finish);
