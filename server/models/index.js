'use strict';

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/config.js')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(process.env[config.use_env_variable], {
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  logging: false,
});

const db = {};

db.User = require('./user')(sequelize, DataTypes);
db.Envelope = require('./envelope')(sequelize, DataTypes);
db.Transaction = require('./transaction')(sequelize, DataTypes);
db.PlannedExpense = require('./plannedExpense')(sequelize, DataTypes);
db.CsvImport = require('./csvImport')(sequelize, DataTypes);
db.Category = require('./category')(sequelize, DataTypes);
db.AiCall = require('./aiCall')(sequelize, DataTypes);

// Associations — mirrors docs/DATABASE.md § ERD
db.User.hasMany(db.Envelope, { foreignKey: 'user_id', onDelete: 'CASCADE' });
db.Envelope.belongsTo(db.User, { foreignKey: 'user_id' });

db.User.hasMany(db.Transaction, { foreignKey: 'user_id', onDelete: 'CASCADE' });
db.Transaction.belongsTo(db.User, { foreignKey: 'user_id' });

db.Envelope.hasMany(db.Transaction, { foreignKey: 'envelope_id', onDelete: 'SET NULL' });
db.Transaction.belongsTo(db.Envelope, { foreignKey: 'envelope_id' });

db.User.hasMany(db.PlannedExpense, { foreignKey: 'user_id', onDelete: 'CASCADE' });
db.PlannedExpense.belongsTo(db.User, { foreignKey: 'user_id' });

db.Envelope.hasMany(db.PlannedExpense, { foreignKey: 'envelope_id', onDelete: 'SET NULL' });
db.PlannedExpense.belongsTo(db.Envelope, { foreignKey: 'envelope_id' });

db.User.hasMany(db.CsvImport, { foreignKey: 'user_id', onDelete: 'CASCADE' });
db.CsvImport.belongsTo(db.User, { foreignKey: 'user_id' });

// SET NULL, not CASCADE — deleting a user must not erase historical AI
// usage from /api/admin/stats' aiCallCount (docs/DATABASE.md § ai_calls).
db.User.hasMany(db.AiCall, { foreignKey: 'user_id', onDelete: 'SET NULL' });
db.AiCall.belongsTo(db.User, { foreignKey: 'user_id' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
