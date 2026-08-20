'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Backs the onboarding wizard's income step (client/src/components/
    // onboarding/IncomeStep.jsx) and SummaryBar's income figure — previously
    // client-only, stored in localStorage (mockIncomeService.js), so it never
    // reached the DB and vanished on a different device/browser.
    await queryInterface.createTable('income_sources', {
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
      // First-of-month convention — same as envelopes.month.
      month: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      amount_agorot: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // Preserves the order rows were entered in on the client (IncomeStep.jsx).
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    });

    // Every GET/PUT filters by both — same reasoning as envelopes' (user_id, month) index.
    await queryInterface.addIndex('income_sources', ['user_id', 'month']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('income_sources');
  },
};
