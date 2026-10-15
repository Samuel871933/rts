import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  /** Required in production; generated once and kept in data/ otherwise. */
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /** Set when running behind a reverse proxy (rate limits use the client IP). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** sqlite for local dev; mysql works with MySQL or MariaDB. */
  DB_DIALECT: z.enum(['sqlite', 'mysql']).default('sqlite'),
  DB_STORAGE: z.string().default('./data/macrogod.sqlite'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('macrogod'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
});

const parsed = schema.parse(process.env);

/**
 * Never a value from the source code: a known secret lets anyone forge tokens. Outside production
 * a random one is created next to the database and reused across restarts (tokens stay valid).
 */
function jwtSecret(): string {
  if (parsed.JWT_SECRET) return parsed.JWT_SECRET;
  if (parsed.NODE_ENV === 'production') throw new Error('JWT_SECRET (32 caractères minimum) est requis en production');
  const file = path.resolve(path.dirname(parsed.DB_STORAGE), 'jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const env = { ...parsed, JWT_SECRET: jwtSecret() };
export type Env = typeof env;
