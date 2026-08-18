'use strict';

module.exports = (sequelize, DataTypes) => {
  const AiCall = sequelize.define(
    'AiCall',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER },
      // 'quick_entry' | 'csv_mapping'
      kind: { type: DataTypes.STRING(20), allowNull: false },
      succeeded: { type: DataTypes.BOOLEAN, allowNull: false },
    },
    {
      tableName: 'ai_calls',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return AiCall;
};
