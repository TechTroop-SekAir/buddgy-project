'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlannedExpense = sequelize.define(
    'PlannedExpense',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      envelope_id: { type: DataTypes.INTEGER },
      title: { type: DataTypes.STRING(160) },
      amount_agorot: { type: DataTypes.INTEGER },
      due_date: { type: DataTypes.DATEONLY },
      // UNIQUE — re-syncs UPSERT on this column, never blind-insert.
      google_event_id: { type: DataTypes.STRING(128), unique: true },
      is_confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // 'calendar' | 'manual'
      source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'calendar' },
      // The transaction created when this row was confirmed — see
      // plannedExpenseService.js's update(). Null until confirmed.
      transaction_id: { type: DataTypes.INTEGER },
    },
    {
      tableName: 'planned_expenses',
      underscored: true,
      timestamps: false,
    }
  );

  return PlannedExpense;
};
