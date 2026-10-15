import type { AuthenticatedRequest } from '../middleware/auth';
import * as matchService from '../services/match.service';
import { asyncHandler } from '../utils/http';

type MatchRequest = AuthenticatedRequest & { params: { id: string } };

export const create = asyncHandler<AuthenticatedRequest>(async (req, res) => {
  res.status(201).json({ match: await matchService.createMatch(req.userId, req.body) });
});

export const list = asyncHandler<AuthenticatedRequest>(async (req, res) => {
  res.json({ matches: await matchService.listMatches(req.userId) });
});

export const show = asyncHandler<MatchRequest>(async (req, res) => {
  res.json({ match: await matchService.getMatch(req.userId, req.params.id) });
});

export const finish = asyncHandler<MatchRequest>(async (req, res) => {
  res.json({ match: await matchService.abandonMatch(req.userId, req.params.id) });
});

export const log = asyncHandler<MatchRequest>(async (req, res) => {
  res.json(await matchService.getMatchLog(req.userId, req.params.id));
});

export const addCommand = asyncHandler<MatchRequest>(async (req, res) => {
  await matchService.addCommand(req.userId, req.params.id, req.body);
  res.status(201).json({ ok: true });
});

export const setClock = asyncHandler<MatchRequest>(async (req, res) => {
  res.json({ clock: await matchService.setClock(req.userId, req.params.id, req.body) });
});
