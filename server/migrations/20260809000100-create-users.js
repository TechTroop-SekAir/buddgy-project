'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
      },
      full_name: {
        type: Sequelize.STRING(120),
      },
      avatar_url: {
        type: Sequelize.TEXT,
      },
      google_refresh_token: {
        type: Sequelize.TEXT,
      },
      role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'user',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  },
};
