import type { GameCommand } from '@macrogod/shared';
import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../db/sequelize';
import type { Match } from './Match';

/** One player command of a match, stamped with its tick: replaying them rebuilds the game. */
export class MatchCommand extends Model<InferAttributes<MatchCommand>, InferCreationAttributes<MatchCommand>> {
  declare id: CreationOptional<number>;
  declare matchId: ForeignKey<Match['id']>;
  declare tick: number;
  /** Client-side sequence number (null for commands saved before it existed). */
  declare seq: number | null;
  declare command: GameCommand;
  declare createdAt: CreationOptional<Date>;
}

MatchCommand.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tick: { type: DataTypes.INTEGER, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    command: { type: DataTypes.JSON, allowNull: false },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'match_commands', updatedAt: false, indexes: [{ name: 'match_commands_match_seq', unique: true, fields: ['matchId', 'seq'] }] },
);
