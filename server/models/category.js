'use strict';

// Global admin catalog (docs/API.md § Admin, /api/admin/categories) — a
// standalone reference table with no FK to any other table, feeding the AI
// classification engine (docs/OVERVIEW.md § Admin). Not to be confused with
// client/src/services/categoryService.js, which is the "Category" rename of
// the per-user, per-month `envelopes` table — see that file's header comment
// and docs/PLAN.md ticket A-06 for the naming-collision note.
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    'Category',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name_he: { type: DataTypes.STRING(80), allowNull: false },
      name_en: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      color: { type: DataTypes.STRING(7) },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'categories',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return Category;
};
