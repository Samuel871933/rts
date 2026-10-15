import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from '../config/env';

function createSequelize(): Sequelize {
  if (env.DB_DIALECT === 'sqlite') {
    const storage = path.resolve(env.DB_STORAGE);
    fs.mkdirSync(path.dirname(storage), { recursive: true });
    return new Sequelize({ dialect: 'sqlite', storage, logging: false });
  }
  return new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
    dialect: 'mysql',
    host: env.DB_HOST,
    port: env.DB_PORT,
    logging: false,
  });
}

export const sequelize = createSequelize();
