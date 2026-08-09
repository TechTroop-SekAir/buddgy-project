'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('planned_expenses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      envelope_id: {
        type: Sequelize.INTEGER,
        // Nullable until the user assigns it
        references: { model: 'envelopes', key: 'id' },
        onDelete: 'SET NULL',
      },
      title: {
        type: Sequelize.STRING(160),
      },
      amount_agorot: {
        type: Sequelize.INTEGER,
      },
      due_date: {
        type: Sequelize.DATEONLY,
      },
      google_event_id: {
        // UNIQUE — prevents duplicate sync; sync re-runs UPSERT on this column.
        type: Sequelize.STRING(128),
        unique: true,
      },
      is_confirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    // Powers the forecast window query.
    await queryInterface.addIndex('planned_expenses', ['user_id', 'due_date']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('planned_expenses');
  },
};
