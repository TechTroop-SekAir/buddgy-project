'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_calls', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        // SET NULL, not the CASCADE every other user-owned table uses
        // (docs/DATABASE.md § ERD) — deleting a user must not erase
        // historical AI usage from /api/admin/stats' aiCallCount.
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      kind: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      succeeded: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_calls');
  },
};
