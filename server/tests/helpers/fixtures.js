'use strict';

// Fixture factories for the ticket B-09 integration layer — insert real rows
// via the real models (server/tests/helpers/db.js's `resetDb()` wipes them
// between tests). Every factory takes an optional overrides object and
// returns the plain Sequelize instance (not `.get({ plain: true })`) so
// callers can read `.id` etc. directly, same as the app's own services do.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Envelope, Transaction, PlannedExpense, CsvImport } = require('../../models');

const FIXTURE_PASSWORD = 'password123';
const BCRYPT_ROUNDS = 12; // matches server/services/authService.js

// bcrypt at production cost factor is deliberately slow — hash it once and
// reuse for every fixture user, rather than paying that cost per insert.
let cachedPasswordHash;
async function passwordHash() {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await bcrypt.hash(FIXTURE_PASSWORD, BCRYPT_ROUNDS);
  }
  return cachedPasswordHash;
}

let uniqueCounter = 0;
/** Monotonic per-process suffix — cheaper and more predictable than random ids for unique columns (email, name_en, google_event_id). */
function unique(prefix) {
  uniqueCounter += 1;
  return `${prefix}-${uniqueCounter}`;
}

async function createUser(overrides = {}) {
  return User.create({
    email: overrides.email ?? `${unique('user')}@test.buddgy.com`,
    password_hash: overrides.password_hash ?? (await passwordHash()),
    full_name: overrides.full_name ?? 'Test User',
    role: overrides.role ?? 'user',
    disabled: overrides.disabled ?? false,
  });
}

async function createEnvelope(overrides = {}) {
  return Envelope.create({
    user_id: overrides.user_id,
    name: overrides.name ?? 'Groceries',
    monthly_budget_agorot: overrides.monthly_budget_agorot ?? 100000,
    color: overrides.color ?? '#f97316',
    month: overrides.month ?? '2026-08-01',
  });
}

async function createTransaction(overrides = {}) {
  return Transaction.create({
    user_id: overrides.user_id,
    envelope_id: overrides.envelope_id ?? null,
    amount_agorot: 'amount_agorot' in overrides ? overrides.amount_agorot : 3400,
    description: overrides.description ?? 'Coffee',
    source: overrides.source ?? 'manual',
    transaction_date: overrides.transaction_date ?? '2026-08-05',
    dedup_hash: overrides.dedup_hash ?? null,
  });
}

async function createPlannedExpense(overrides = {}) {
  return PlannedExpense.create({
    user_id: overrides.user_id,
    envelope_id: overrides.envelope_id ?? null,
    title: overrides.title ?? 'Car service',
    // `??` would treat an explicit `amount_agorot: null` (the "missing
    // amount" case forecastService.js surfaces) as "not provided" and
    // silently default it to 45000 — use `in` so null is respected.
    amount_agorot: 'amount_agorot' in overrides ? overrides.amount_agorot : 45000,
    due_date: overrides.due_date ?? '2026-08-20',
    google_event_id: overrides.google_event_id ?? unique('evt'),
    is_confirmed: overrides.is_confirmed ?? false,
    source: overrides.source ?? 'calendar',
    // The transaction this row spawned when confirmed — see
    // plannedExpenseService.js's update(). Lets a test construct the
    // "already linked" state directly, without going through the endpoint.
    transaction_id: overrides.transaction_id ?? null,
    // 'likely' (not the model's 'unknown' default) so a fixture-created row
    // is a normal planned expense a test can rely on, including surfacing in
    // forecastService.js's missingAmountPlannedExpenses query, which gates
    // on cost_likelihood: 'likely' (docs/features/UPCOMING-EVENTS.md §
    // Forecast Impact). Override to 'unknown'/'unlikely' to construct the
    // calendar-classifier's other states on purpose.
    cost_likelihood: overrides.cost_likelihood ?? 'likely',
    is_dismissed: overrides.is_dismissed ?? false,
  });
}

async function createCsvImport(overrides = {}) {
  return CsvImport.create({
    user_id: overrides.user_id,
    file_url: overrides.file_url ?? `https://storage.test.buddgy.com/${unique('csv')}.csv`,
    column_mapping: overrides.column_mapping ?? { date: 'Date', amount: 'Amount', description: 'Description' },
    rows_imported: 'rows_imported' in overrides ? overrides.rows_imported : null,
  });
}

/** Signs a real JWT for the given user — mirrors server/services/authService.js's signToken, and the pattern every server/__tests__/*.test.js file already uses. */
function authHeader(user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

module.exports = {
  FIXTURE_PASSWORD,
  createUser,
  createEnvelope,
  createTransaction,
  createPlannedExpense,
  createCsvImport,
  authHeader,
};
