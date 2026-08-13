'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('csv_imports', {
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
      file_url: {
        type: Sequelize.TEXT,
      },
      column_mapping: {
        type: Sequelize.JSONB,
      },
      rows_imported: {
        type: Sequelize.INTEGER,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('csv_imports');
  },
};
