'use strict';

module.exports = {
  up: async (queryInterface) => {
    // Postgres doesn't auto-index FK child columns. transactionService.js's
    // remove() now looks up planned_expenses by transaction_id on every
    // transaction delete (server/services/transactionService.js), and the
    // ON DELETE SET NULL trigger scans this column too — both were sequential
    // scans without this index.
    await queryInterface.addIndex('planned_expenses', ['transaction_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('planned_expenses', ['transaction_id']);
  },
};
