import type { Model, ModelStatic } from 'sequelize';
import { sequelize } from '../db/sequelize';
import { Match } from './Match';
import { MatchCommand } from './MatchCommand';
import { User } from './User';

User.hasMany(Match, { foreignKey: { name: 'userId', allowNull: false }, as: 'matches', onDelete: 'CASCADE' });
Match.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false }, as: 'user' });
Match.hasMany(MatchCommand, { foreignKey: { name: 'matchId', allowNull: false }, as: 'commands', onDelete: 'CASCADE' });
MatchCommand.belongsTo(Match, { foreignKey: { name: 'matchId', allowNull: false }, as: 'match' });

/**
 * sync() creates missing tables (and their indexes) but never alters existing ones: add the
 * columns new model attributes need. Swap for real sequelize migrations once the schema stabilizes.
 */
async function addMissingColumns(model: ModelStatic<Model>) {
  const qi = sequelize.getQueryInterface();
  const table = model.getTableName() as string;
  if (!(await qi.tableExists(table))) return; // sync() will create it whole
  const existing = await qi.describeTable(table);
  for (const [name, attr] of Object.entries(model.getAttributes())) {
    const column = attr.field ?? name;
    if (column in existing) continue;
    await qi.addColumn(table, column, { type: attr.type, allowNull: attr.allowNull ?? true, defaultValue: attr.defaultValue });
    console.log(`[db] colonne ajoutée : ${table}.${column}`);
  }
}

/**
 * Before the unique (matchId, seq) index is created: racing resends could store a command twice.
 * Keeps the first copy (rows without seq predate it and are left alone).
 */
async function dropDuplicateCommands() {
  const qi = sequelize.getQueryInterface();
  if (!(await qi.tableExists(MatchCommand.getTableName() as string))) return;
  await sequelize.query(
    'DELETE FROM match_commands WHERE seq IS NOT NULL AND id NOT IN ' +
      '(SELECT id FROM (SELECT MIN(id) AS id FROM match_commands WHERE seq IS NOT NULL GROUP BY matchId, seq) AS keep_rows)',
  );
}

export async function initDatabase() {
  await sequelize.authenticate();
  // Columns first: sync() creates the indexes, which may use a column an old table lacks.
  for (const model of [User, Match, MatchCommand]) await addMissingColumns(model);
  await dropDuplicateCommands();
  await sequelize.sync();
}

export { Match, MatchCommand, User, sequelize };
