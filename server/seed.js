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
const ADMIN_EMAIL = 'admin@buddgy.com';
const ADMIN_PASSWORD = 'password123';

async function seedUser(email, password, full_name, role) {
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: { email, password_hash, full_name, role },
  });

  if (created) {
    console.log(`Seeded ${role} user: ${email} / ${password}`);
  } else {
    console.log(`${role[0].toUpperCase()}${role.slice(1)} user already exists: ${email} (id ${user.id})`);
  }
}

async function run() {
  try {
    await seedUser(DEV_EMAIL, DEV_PASSWORD, 'Dev User', 'user');
    await seedUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin User', 'admin');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
