'use strict';

module.exports = (sequelize, DataTypes) => {
  const CsvImport = sequelize.define(
    'CsvImport',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      file_url: { type: DataTypes.TEXT },
      column_mapping: { type: DataTypes.TEXT },
      rows_imported: { type: DataTypes.INTEGER },
    },
    {
      tableName: 'csv_imports',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return CsvImport;
};
