'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Existing rows are all calendar-sync-created — defaultValue backfills them
    // as 'calendar' without a separate data migration step.
    await queryInterface.addColumn('planned_expenses', 'source', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'calendar',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('planned_expenses', 'source');
  },
};
