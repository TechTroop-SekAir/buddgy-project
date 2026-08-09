'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('transactions', {
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
        // NULL if unassigned
        references: { model: 'envelopes', key: 'id' },
        onDelete: 'SET NULL',
      },
      amount_agorot: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
      },
      source: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      transaction_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      dedup_hash: {
        // Nullable — manual transactions have none. Postgres UNIQUE permits
        // repeated NULLs, so this still guards CSV re-imports without
        // requiring every row to have one. See docs/DATABASE.md § Idempotency.
        type: Sequelize.STRING(64),
        unique: true,
      },
    });

    // Powers the transaction list, date filters, and forecast aggregation.
    await queryInterface.addIndex('transactions', ['user_id', 'transaction_date']);
    // Powers per-envelope balance calculation.
    await queryInterface.addIndex('transactions', ['envelope_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('transactions');
  },
};
