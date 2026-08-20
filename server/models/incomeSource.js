'use strict';

module.exports = (sequelize, DataTypes) => {
  const IncomeSource = sequelize.define(
    'IncomeSource',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      // First-of-month convention — an income source is scoped to a single month.
      month: { type: DataTypes.DATEONLY, allowNull: false },
      label: { type: DataTypes.STRING(80), allowNull: false },
      amount_agorot: { type: DataTypes.INTEGER, allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'income_sources',
      underscored: true,
      timestamps: false,
    }
  );

  return IncomeSource;
};
