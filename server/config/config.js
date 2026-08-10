// Sequelize CLI config. Reads DATABASE_URL for every environment rather than
// discrete host/user/pass fields — matches how Railway and local .env both
// expose the connection. See docs/DATABASE.md § Conventions.
require('dotenv').config();

const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
};

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './dev.db',
  },
  test: { ...base },
  production: {
    ...base,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  },
};
