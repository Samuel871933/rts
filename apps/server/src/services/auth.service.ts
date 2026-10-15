import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env } from '../config/env';
import { User, type PublicUser } from '../models/User';
import { conflict, unauthorized } from '../utils/http';
import type { LoginInput, RegisterInput, SettingsInput } from '../validators/auth.schemas';

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  user: PublicUser;
}

const JWT_OPTIONS = { algorithm: 'HS256', issuer: 'macrogod', audience: 'macrogod-api' } as const;

/** Compared against when the account doesn't exist, so a login takes as long either way. */
const DUMMY_HASH = bcrypt.hashSync('macrogod-timing-placeholder', BCRYPT_ROUNDS);

function signToken(user: User): string {
  return jwt.sign({ sub: user.id }, env.JWT_SECRET, { ...JWT_OPTIONS, expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): { sub: number } {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [JWT_OPTIONS.algorithm],
    issuer: JWT_OPTIONS.issuer,
    audience: JWT_OPTIONS.audience,
  });
  if (typeof payload === 'string' || typeof payload.sub !== 'number') throw new Error('Invalid token payload');
  return { sub: payload.sub };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({
    where: { [Op.or]: [{ username: input.username }, { email: input.email }] },
  });
  if (existing) {
    throw conflict(existing.email === input.email ? 'Cet email est déjà utilisé' : "Ce pseudo est déjà pris");
  }
  const user = await User.create({
    username: input.username,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
  });
  return { token: signToken(user), user: user.toPublic() };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({
    where: { [Op.or]: [{ username: input.login }, { email: input.login.toLowerCase() }] },
  });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw unauthorized('Identifiants incorrects');
  }
  return { token: signToken(user), user: user.toPublic() };
}

export async function getUser(id: number): Promise<PublicUser> {
  const user = await User.findByPk(id);
  if (!user) throw unauthorized();
  return user.toPublic();
}

export async function updateSettings(id: number, input: SettingsInput): Promise<PublicUser> {
  const user = await User.findByPk(id);
  if (!user) throw unauthorized();
  await user.update({ settings: { ...user.settings, ...input } });
  return user.toPublic();
}
