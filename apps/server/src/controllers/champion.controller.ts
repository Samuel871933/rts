import { CHAMPIONS } from '@macrogod/shared';
import type { RequestHandler } from 'express';

/** Champion catalog. Every champion is unlocked for now; unlocks will hang off the user account. */
export const listChampions: RequestHandler = (_req, res) => {
  res.json({ champions: CHAMPIONS.map((c) => ({ ...c, unlocked: true })) });
};
