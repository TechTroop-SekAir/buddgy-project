'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Links a planned expense to the transaction it spawns once confirmed
    // (server/services/plannedExpenseService.js). Nullable — unconfirmed rows,
    // and legacy rows confirmed before this migration shipped, have none.
    // SET NULL mirrors the existing envelope_id FK pattern on both tables:
    // deleting the transaction shouldn't cascade-delete the planning record.
    await queryInterface.addColumn('planned_expenses', 'transaction_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'transactions', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('planned_expenses', 'transaction_id');
  },
};
