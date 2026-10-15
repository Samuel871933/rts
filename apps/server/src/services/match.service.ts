import { randomInt } from 'node:crypto';
import { randomComposition } from '@macrogod/shared';
import { Match } from '../models/Match';
import { badRequest, notFound } from '../utils/http';
import type { CreateMatchInput, FinishMatchInput } from '../validators/match.schemas';

export async function createMatch(userId: number, input: CreateMatchInput): Promise<Match> {
  return Match.create({
    userId,
    seed: randomInt(1, 2 ** 31 - 1),
    composition: input.composition,
    enemyComposition: randomComposition(),
    durationSec: null,
    stats: null,
    finishedAt: null,
  });
}

export async function getMatch(userId: number, id: string): Promise<Match> {
  const match = await Match.findOne({ where: { id, userId } });
  if (!match) throw notFound('Partie introuvable');
  return match;
}

export async function finishMatch(userId: number, id: string, input: FinishMatchInput): Promise<Match> {
  const match = await getMatch(userId, id);
  if (match.status !== 'in_progress') throw badRequest('Cette partie est déjà terminée');
  return match.update({
    status: input.status,
    durationSec: input.durationSec,
    stats: input.stats ?? null,
    finishedAt: new Date(),
  });
}

export async function listMatches(userId: number, limit = 20): Promise<Match[]> {
  return Match.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit });
}
