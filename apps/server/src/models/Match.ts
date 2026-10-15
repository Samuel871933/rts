import type { ChampionPick } from '@macrogod/shared';
import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../db/sequelize';
import type { User } from './User';

export const MATCH_STATUSES = ['in_progress', 'victory', 'defeat', 'abandoned'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export interface MatchChampionStats {
  championId: string;
  level: number;
  kills: number;
  deaths: number;
  cs: number;
  gold: number;
}

export class Match extends Model<InferAttributes<Match>, InferCreationAttributes<Match>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;
  declare seed: number;
  declare composition: ChampionPick[];
  /** Random opponents drawn at creation (null for matches created before opponents existed). */
  declare enemyComposition: ChampionPick[] | null;
  declare status: CreationOptional<MatchStatus>;
  declare durationSec: number | null;
  declare stats: MatchChampionStats[] | null;
  declare finishedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Match.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    seed: { type: DataTypes.INTEGER, allowNull: false },
    composition: { type: DataTypes.JSON, allowNull: false },
    enemyComposition: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'in_progress' },
    durationSec: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    stats: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    finishedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'matches', indexes: [{ fields: ['userId', 'createdAt'] }] },
);
