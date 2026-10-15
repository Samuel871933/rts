import type { AuthenticatedRequest } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/http';

export const register = asyncHandler(async (req, res) => {
  res.status(201).json(await authService.register(req.body));
});

export const login = asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
});

export const me = asyncHandler<AuthenticatedRequest>(async (req, res) => {
  res.json({ user: await authService.getUser(req.userId) });
});

export const updateSettings = asyncHandler<AuthenticatedRequest>(async (req, res) => {
  res.json({ user: await authService.updateSettings(req.userId, req.body) });
});
