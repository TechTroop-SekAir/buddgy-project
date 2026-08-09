'use strict';

module.exports = (sequelize, DataTypes) => {
  const Envelope = sequelize.define(
    'Envelope',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(80), allowNull: false },
      monthly_budget_agorot: { type: DataTypes.INTEGER, allowNull: false },
      color: { type: DataTypes.STRING(7) },
      // First-of-month convention — an envelope is scoped to a single month.
      month: { type: DataTypes.DATEONLY, allowNull: false },
    },
    {
      tableName: 'envelopes',
      underscored: true,
      timestamps: false,
    }
  );

  return Envelope;
};
