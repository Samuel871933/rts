import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { listChampions } from '../controllers/champion.controller';
import * as matches from '../controllers/match.controller';
import { requireAuth } from '../middleware/auth';
import { gameplayLimiter, loginLimiter, registerLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema, settingsSchema } from '../validators/auth.schemas';
import { clockSchema, commandSchema, createMatchSchema, finishMatchSchema } from '../validators/match.schemas';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

apiRouter.post('/auth/register', registerLimiter, validateBody(registerSchema), auth.register);
apiRouter.post('/auth/login', loginLimiter, validateBody(loginSchema), auth.login);
apiRouter.get('/auth/me', requireAuth, auth.me);
apiRouter.put('/auth/me/settings', requireAuth, gameplayLimiter, validateBody(settingsSchema), auth.updateSettings);

apiRouter.get('/champions', requireAuth, listChampions);

apiRouter.get('/matches', requireAuth, matches.list);
apiRouter.post('/matches', requireAuth, gameplayLimiter, validateBody(createMatchSchema), matches.create);
apiRouter.get('/matches/:id', requireAuth, matches.show);
apiRouter.get('/matches/:id/log', requireAuth, matches.log);
apiRouter.post('/matches/:id/commands', requireAuth, gameplayLimiter, validateBody(commandSchema), matches.addCommand);
apiRouter.put('/matches/:id/clock', requireAuth, gameplayLimiter, validateBody(clockSchema), matches.setClock);
apiRouter.patch('/matches/:id/finish', requireAuth, validateBody(finishMatchSchema), matches.finish);
