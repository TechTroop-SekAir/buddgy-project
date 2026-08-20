'use strict';

// The `categories` table (global admin catalog: name_he/name_en/color/
// is_active) was never wired to any feature — claudeService.buildPrompt()
// classifies against the user's envelopes only, and transactions has no
// column to persist a category label. Dropped as dead schema; see
// docs/PLAN.md ticket B-06 removal note and the naming-collision entry it
// replaces. down() recreates it exactly as
// 20260809000600-create-categories.js did, so this migration fully reverses.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.dropTable('categories');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name_he: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      name_en: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      color: {
        type: Sequelize.STRING(7),
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
    });
  },
};
