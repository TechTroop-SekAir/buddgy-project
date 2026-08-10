// server/seed.js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL);

async function run() {
  try {
    await sequelize.query(`
      INSERT INTO users (id, email, password_hash) 
      VALUES (1, 'test@buddgy.com', 'hash123') 
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✅ המשתמש מוכן!');
  } catch (err) {
    console.error('❌ שגיאה:', err.message);
  } finally {
    process.exit();
  }
}

run();