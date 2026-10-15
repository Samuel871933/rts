import 'dotenv/config';
import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-change-me-in-production';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    JWT_SECRET: z.string().min(16).default(DEV_SECRET),
    JWT_EXPIRES_IN: z.string().default('7d'),
    /** sqlite for local dev; mysql works with MySQL or MariaDB. */
    DB_DIALECT: z.enum(['sqlite', 'mysql']).default('sqlite'),
    DB_STORAGE: z.string().default('./data/macrogod.sqlite'),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_NAME: z.string().default('macrogod'),
    DB_USER: z.string().default('root'),
    DB_PASSWORD: z.string().default(''),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET !== DEV_SECRET, {
    message: 'JWT_SECRET must be set in production',
    path: ['JWT_SECRET'],
  });

export const env = schema.parse(process.env);
export type Env = typeof env;
