import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import type { PlayerSettings } from '@macrogod/shared';
import { sequelize } from '../db/sequelize';

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  settings: PlayerSettings;
  createdAt: Date;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare email: string;
  declare passwordHash: string;
  /** Hotkeys and other per-player preferences (null until first saved). */
  declare settings: CreationOptional<PlayerSettings | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toPublic(): PublicUser {
    return { id: this.id, username: this.username, email: this.email, settings: this.settings ?? {}, createdAt: this.createdAt };
  }
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(100), allowNull: false },
    settings: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'users' },
);
