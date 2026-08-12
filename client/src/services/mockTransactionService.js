// Fake backend for ticket A-07, mirroring mockEnvelopeService.js's structure.
// No real transactions system exists yet (server/routes/transactions.js only
// has /parse — B-05's CRUD isn't built), so this seeds its own data, borrowing
// envelope ids from mockEnvelopeService so envelope_id references stay valid.
// Only `list` is implemented — create/delete belong to ticket A-08.
import * as mockEnvelopeService from './mockEnvelopeService';

const TRANSACTIONS_KEY = 'buddgy_mock_transactions';
const SEEDED_USERS_KEY = 'buddgy_mock_transactions_seeded_users';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadTransactions() {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
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

// (description, source, day-of-month, amount_agorot) — cycled across the
// seeded envelopes so search/category/date filters all have something to hit.
const DEFAULT_TRANSACTIONS = [
  { description: 'Rent payment', source: 'manual', day: 1, amount_agorot: 500000 },
  { description: 'Electric bill', source: 'csv', day: 3, amount_agorot: 18000 },
  { description: 'Supermarket run', source: 'quick_entry', day: 4, amount_agorot: 32500 },
  { description: 'Coffee with Noa', source: 'quick_entry', day: 5, amount_agorot: 3400 },
  { description: 'Bus pass', source: 'manual', day: 6, amount_agorot: 22000 },
  { description: 'Pharmacy', source: 'csv', day: 8, amount_agorot: 9500 },
  { description: 'Doctor visit copay', source: 'manual', day: 9, amount_agorot: 15000 },
  { description: 'Movie tickets', source: 'quick_entry', day: 11, amount_agorot: 8000 },
  { description: 'Restaurant dinner', source: 'quick_entry', day: 13, amount_agorot: 21000 },
  { description: 'Streaming subscription', source: 'csv', day: 14, amount_agorot: 5400 },
  { description: 'Grocery delivery', source: 'csv', day: 16, amount_agorot: 28000 },
  { description: 'Clothing store', source: 'manual', day: 18, amount_agorot: 34000 },
  { description: 'Phone bill', source: 'csv', day: 20, amount_agorot: 12000 },
  { description: 'Gym membership', source: 'manual', day: 22, amount_agorot: 16000 },
  { description: 'Uber ride', source: 'quick_entry', day: 24, amount_agorot: 4200 },
  { description: 'Home repair supplies', source: 'manual', day: 27, amount_agorot: 45000 },
];

// Last two entries deliberately get envelope_id: null (Uncategorized).
const UNASSIGNED_COUNT = 2;

async function seedIfNeeded(userId, month) {
  const seededUsers = loadSeededUsers();
  if (seededUsers.has(userId)) return;

  const envelopes = await mockEnvelopeService.list(userId, month);
  const transactions = loadTransactions();

  DEFAULT_TRANSACTIONS.forEach((seed, index) => {
    const isUnassigned = index >= DEFAULT_TRANSACTIONS.length - UNASSIGNED_COUNT;
    const envelope = envelopes.length > 0 ? envelopes[index % envelopes.length] : null;
    const day = String(seed.day).padStart(2, '0');

    transactions.push({
      id: crypto.randomUUID(),
      user_id: userId,
      envelope_id: isUnassigned ? null : envelope?.id ?? null,
      amount_agorot: seed.amount_agorot,
      description: seed.description,
      source: seed.source,
      transaction_date: `${month.slice(0, 7)}-${day}`,
      dedup_hash: null,
    });
  });

  saveTransactions(transactions);
  seededUsers.add(userId);
  saveSeededUsers(seededUsers);
}

export async function list(userId, month) {
  await delay(200);
  await seedIfNeeded(userId, month);
  const monthPrefix = month.slice(0, 7);
  return loadTransactions().filter(
    (t) => t.user_id === userId && t.transaction_date.startsWith(monthPrefix)
  );
}
