'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('envelopes', {
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
      name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      monthly_budget_agorot: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING(7),
      },
      month: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
    });

    // Every dashboard load filters by both — GET /api/envelopes?month=
    await queryInterface.addIndex('envelopes', ['user_id', 'month']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('envelopes');
  },
};
