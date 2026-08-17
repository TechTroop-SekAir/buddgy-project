// server/seed.js — creates a known dev login, safe to re-run.
// Goes through models/index.js (not a raw DATABASE_URL connection) so it
// picks up the same dialect/config as the rest of the app, and through
// bcrypt at the same cost factor as services/authService.js so the account
// this creates can actually log in via POST /api/auth/login.
'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Category } = require('./models');

const BCRYPT_ROUNDS = 12; // matches services/authService.js
const DEV_EMAIL = 'test@buddgy.com';
const DEV_PASSWORD = 'password123';
const ADMIN_EMAIL = 'admin@buddgy.com';
const ADMIN_PASSWORD = 'password123';

// Default admin catalog (docs/API.md § Admin, /api/admin/categories) — seeds
// the taxonomy the AI classification engine (docs/INTEGRATIONS.md) and admin
// panel (A-14) start with. Idempotent via bulkCreate's ignoreDuplicates below.
const DEFAULT_CATEGORIES = [
  { name_he: 'מזון', name_en: 'Food', color: '#f97316' },
  { name_he: 'תחבורה', name_en: 'Transportation', color: '#3b82f6' },
  { name_he: 'דיור', name_en: 'Housing', color: '#8b5cf6' },
  { name_he: 'בילויים', name_en: 'Entertainment', color: '#ec4899' },
  { name_he: 'בריאות', name_en: 'Health', color: '#ef4444' },
  { name_he: 'חינוך', name_en: 'Education', color: '#14b8a6' },
  { name_he: 'ביגוד', name_en: 'Clothing', color: '#eab308' },
  { name_he: 'חשבונות', name_en: 'Bills', color: '#64748b' },
  { name_he: 'חסכונות', name_en: 'Savings', color: '#22c55e' },
  { name_he: 'אחר', name_en: 'Other', color: '#a1a1aa' },
];

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

async function seedCategories() {
  const created = await Category.bulkCreate(DEFAULT_CATEGORIES, { ignoreDuplicates: true });
  console.log(`Seeded category catalog: ${created.length} row(s) inserted (existing rows left untouched).`);
}

async function run() {
  try {
    await seedUser(DEV_EMAIL, DEV_PASSWORD, 'Dev User', 'user');
    await seedUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin User', 'admin');
    await seedCategories();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
