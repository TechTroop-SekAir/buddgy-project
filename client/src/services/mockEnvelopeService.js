// Fake backend for ticket A-05, mirroring mockAuthService.js's structure.
// No real transactions system exists yet (server/routes/transactions.js only
// has /parse — B-05's CRUD isn't built), so spent_agorot is stored directly
// on the envelope here as a mock-only field. Remove once real
// transaction-derived spend lands and envelopeService.js swaps to the real API.
const ENVELOPES_KEY = 'buddgy_mock_envelopes';
const SEEDED_USERS_KEY = 'buddgy_mock_envelopes_seeded_users';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnvelopes() {
  try {
    const raw = localStorage.getItem(ENVELOPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEnvelopes(envelopes) {
  localStorage.setItem(ENVELOPES_KEY, JSON.stringify(envelopes));
}

function loadSeededUsers() {
  try {
    const raw = localStorage.getItem(SEEDED_USERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeededUsers(seededUsers) {
  localStorage.setItem(SEEDED_USERS_KEY, JSON.stringify([...seededUsers]));
}

// Chosen so Housing lands at 95% (amber) and Dining Out at 105% (red), the
// rest under 75% (green) — demonstrates all three status states per
// docs/PLAN-DETAILS.md.
const DEFAULT_ENVELOPES = [
  { name: 'Housing', monthly_budget_agorot: 500000, spent_agorot: 475000 },
  { name: 'Utilities', monthly_budget_agorot: 40000, spent_agorot: 20000 },
  { name: 'Groceries', monthly_budget_agorot: 200000, spent_agorot: 120000 },
  { name: 'Transport', monthly_budget_agorot: 60000, spent_agorot: 30000 },
  { name: 'Healthcare', monthly_budget_agorot: 50000, spent_agorot: 10000 },
  { name: 'Dining Out', monthly_budget_agorot: 100000, spent_agorot: 105000 },
  { name: 'Entertainment', monthly_budget_agorot: 30000, spent_agorot: 15000 },
  { name: 'Shopping', monthly_budget_agorot: 40000, spent_agorot: 10000 },
];

function seedIfNeeded(userId, month) {
  const seededUsers = loadSeededUsers();
  if (seededUsers.has(userId)) return;

  const envelopes = loadEnvelopes();
  DEFAULT_ENVELOPES.forEach((seed) => {
    envelopes.push({ id: crypto.randomUUID(), user_id: userId, month, ...seed });
  });
  saveEnvelopes(envelopes);

  seededUsers.add(userId);
  saveSeededUsers(seededUsers);
}

export async function list(userId, month) {
  await delay(200);
  seedIfNeeded(userId, month);
  return loadEnvelopes().filter((e) => e.user_id === userId && e.month === month);
}

export async function create(userId, payload) {
  await delay(200);
  const { name, monthly_budget_agorot, month } = payload;
  if (!name) throw new Error('validation failed: name');
  if (!monthly_budget_agorot || monthly_budget_agorot <= 0) {
    throw new Error('validation failed: monthly_budget_agorot');
  }

  const envelope = {
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    monthly_budget_agorot,
    spent_agorot: 0,
    month,
  };

  const envelopes = loadEnvelopes();
  envelopes.push(envelope);
  saveEnvelopes(envelopes);

  return envelope;
}

export async function update(id, payload) {
  await delay(200);
  const envelopes = loadEnvelopes();
  const index = envelopes.findIndex((e) => e.id === id);
  if (index === -1) throw new Error('not found');

  envelopes[index] = { ...envelopes[index], ...payload };
  saveEnvelopes(envelopes);

  return envelopes[index];
}

export async function remove(id) {
  await delay(200);
  const envelopes = loadEnvelopes();
  const next = envelopes.filter((e) => e.id !== id);
  if (next.length === envelopes.length) throw new Error('not found');

  saveEnvelopes(next);
}
