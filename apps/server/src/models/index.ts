import type { Model, ModelStatic } from 'sequelize';
import { sequelize } from '../db/sequelize';
import { Match } from './Match';
import { User } from './User';

User.hasMany(Match, { foreignKey: { name: 'userId', allowNull: false }, as: 'matches', onDelete: 'CASCADE' });
Match.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false }, as: 'user' });

/**
 * sync() creates missing tables but never alters existing ones: add the columns new model
 * attributes need. Swap for real sequelize migrations once the schema stabilizes.
 */
async function addMissingColumns(model: ModelStatic<Model>) {
  const qi = sequelize.getQueryInterface();
  const table = model.getTableName() as string;
  const existing = await qi.describeTable(table);
  for (const [name, attr] of Object.entries(model.getAttributes())) {
    const column = attr.field ?? name;
    if (column in existing) continue;
    await qi.addColumn(table, column, { type: attr.type, allowNull: attr.allowNull ?? true, defaultValue: attr.defaultValue });
    console.log(`[db] colonne ajoutée : ${table}.${column}`);
  }
}

export async function initDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
  for (const model of [User, Match]) await addMissingColumns(model);
}

export { Match, User, sequelize };
