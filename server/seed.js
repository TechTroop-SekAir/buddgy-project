// server/seed.js — creates a known dev login, safe to re-run.
// Goes through models/index.js (not a raw DATABASE_URL connection) so it
// picks up the same dialect/config as the rest of the app, and through
// bcrypt at the same cost factor as services/authService.js so the account
// this creates can actually log in via POST /api/auth/login.
'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User } = require('./models');

const BCRYPT_ROUNDS = 12; // matches services/authService.js
const DEV_EMAIL = 'test@buddgy.com';
const DEV_PASSWORD = 'password123';

async function run() {
  try {
    const password_hash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_ROUNDS);
    const [user, created] = await User.findOrCreate({
      where: { email: DEV_EMAIL },
      defaults: { email: DEV_EMAIL, password_hash, full_name: 'Dev User', role: 'user' },
    });

    if (created) {
      console.log(`Seeded dev user: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
    } else {
      console.log(`Dev user already exists: ${DEV_EMAIL} (id ${user.id})`);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
