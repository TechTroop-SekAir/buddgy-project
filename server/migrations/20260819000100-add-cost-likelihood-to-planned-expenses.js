'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Existing rows predate classification — defaultValue backfills them as
    // 'unknown' without a separate data migration step. A fresh sync will
    // upgrade amount-bearing rows to 'likely' on its next pass.
    await queryInterface.addColumn('planned_expenses', 'cost_likelihood', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'unknown',
    });
    await queryInterface.addColumn('planned_expenses', 'is_dismissed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('planned_expenses', 'is_dismissed');
    await queryInterface.removeColumn('planned_expenses', 'cost_likelihood');
  },
};
