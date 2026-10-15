import { randomInt } from 'node:crypto';
import { SIM_TICK_RATE, clockTick, randomComposition, type MatchClock } from '@macrogod/shared';
import { UniqueConstraintError } from 'sequelize';
import { Match } from '../models/Match';
import { MatchCommand } from '../models/MatchCommand';
import { badRequest, conflict, notFound } from '../utils/http';
import type { ClockInput, CommandInput, CreateMatchInput } from '../validators/match.schemas';
import { matchRunner, toCommandLog } from './matchRunner';

/** Each running match is simulated by the server: keep a player's share bounded. */
const MAX_RUNNING_PER_USER = 3;
const MAX_COMMANDS_PER_MATCH = 20_000;
/**
 * Real seconds of tolerance on a command's tick: ahead of the server clock (clock skew, the
 * client's own estimate), or behind the previous command (requests racing each other).
 */
const TICK_SLACK_SEC = 10;

export async function createMatch(userId: number, input: CreateMatchInput): Promise<Match> {
  const running = await Match.count({ where: { userId, status: 'in_progress' } });
  if (running >= MAX_RUNNING_PER_USER) {
    throw conflict(`Tu as déjà ${running} parties en cours : reprends-en une ou abandonne-la avant d’en lancer une autre`);
  }
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

async function getRunningMatch(userId: number, id: string): Promise<Match> {
  const match = await getMatch(userId, id);
  if (match.status !== 'in_progress') throw badRequest('Cette partie est déjà terminée');
  return match;
}

/** Everything needed to rebuild the game where it stands: clock + command log, and the server time to sync on. */
export async function getMatchLog(userId: number, id: string) {
  const match = await getMatch(userId, id);
  const rows = await MatchCommand.findAll({ where: { matchId: match.id }, order: [['id', 'ASC']] });
  return { clock: match.clock, commands: toCommandLog(rows), serverNow: Date.now() };
}

/**
 * Idempotent: the client resends unacknowledged commands after a reload, a known seq is ignored.
 * Ticks must follow the match's real-time clock: no commands from the future, none far in the past.
 */
export async function addCommand(userId: number, id: string, input: CommandInput): Promise<void> {
  const match = await getRunningMatch(userId, id);
  if (!match.clock) throw badRequest('La partie n’a pas encore démarré');
  const known = await MatchCommand.findOne({ where: { matchId: match.id, seq: input.seq } });
  if (known) return;

  const slack = TICK_SLACK_SEC * SIM_TICK_RATE * match.clock.speed;
  if (input.tick > clockTick(match.clock, Date.now()) + slack) throw badRequest('Commande en avance sur la partie');
  const last = await MatchCommand.findOne({ where: { matchId: match.id }, order: [['tick', 'DESC']] });
  if (last && input.tick < last.tick - slack) throw badRequest('Commande trop ancienne');
  if ((await MatchCommand.count({ where: { matchId: match.id } })) >= MAX_COMMANDS_PER_MATCH) {
    throw badRequest('Trop de commandes pour cette partie');
  }

  try {
    await MatchCommand.create({ matchId: match.id, tick: input.tick, seq: input.seq, command: input.command });
  } catch (err) {
    if (err instanceof UniqueConstraintError) return; // the same resend won a race
    throw err;
  }
  matchRunner.onCommand(match.id, input);
}

/**
 * Starts the clock, or changes speed / pause. Where the game stands is the server's own reading of
 * the previous clock: a client can't move the game forward or back in time.
 */
export async function setClock(userId: number, id: string, input: ClockInput): Promise<MatchClock> {
  const match = await getRunningMatch(userId, id);
  const now = Date.now();
  const tick = match.clock ? clockTick(match.clock, now) : 0;
  const clock: MatchClock = { tick, at: now, speed: input.speed, paused: input.paused };
  await match.update({ clock });
  matchRunner.onClock(match.id, clock);
  return clock;
}

/** Surrender. Duration and stats come from the server's simulation, not from the client. */
export async function abandonMatch(userId: number, id: string): Promise<Match> {
  const match = await getRunningMatch(userId, id);
  const progress = matchRunner.progress(match.id);
  matchRunner.onFinished(match.id);
  const elapsed = match.clock ? Math.floor(clockTick(match.clock, Date.now()) / SIM_TICK_RATE) : 0;
  return match.update({
    status: 'abandoned',
    durationSec: progress?.durationSec ?? elapsed,
    stats: progress?.stats ?? null,
    finishedAt: new Date(),
  });
}

export async function listMatches(userId: number, limit = 20): Promise<Match[]> {
  return Match.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit });
}
