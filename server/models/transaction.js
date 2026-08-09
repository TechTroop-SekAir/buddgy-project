'use strict';

module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      envelope_id: { type: DataTypes.INTEGER },
      amount_agorot: { type: DataTypes.INTEGER, allowNull: false },
      description: { type: DataTypes.STRING(255) },
      // 'quick_entry' | 'csv' | 'manual'
      source: { type: DataTypes.STRING(20), allowNull: false },
      transaction_date: { type: DataTypes.DATEONLY, allowNull: false },
      // Computed from (user_id, amount_agorot, transaction_date, description)
      // at import time — see docs/DATABASE.md § Idempotency.
      dedup_hash: { type: DataTypes.STRING(64), unique: true },
    },
    {
      tableName: 'transactions',
      underscored: true,
      timestamps: false,
    }
  );

  return Transaction;
};
