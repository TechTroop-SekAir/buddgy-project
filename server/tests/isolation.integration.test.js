'use strict';

// Real-Postgres integration tests for ticket B-10 — the single place that
// states Buddgy's row-level isolation contract end-to-end (docs/SECURITY.md
// § Row-Level Access). Per-endpoint CRUD suites already assert one or two
// cross-user cases each (envelopes/transactions/planned-expenses/forecast
// integration tests) — this file doesn't re-litigate those in full, it adds
// the systematic sweep plus the two subsystems that had no cross-user
// coverage at all: calendar sync and CSV import.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mockEventsList = jest.fn();
jest.mock('googleapis', () => ({
  google: { calendar: () => ({ events: { list: (...args) => mockEventsList(...args) } }) },
}));

const mockGetAuthedClient = jest.fn();
jest.mock('../services/googleCalendarService', () => ({
  getAuthedClient: (...args) => mockGetAuthedClient(...args),
}));

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const {
  createUser,
  createEnvelope,
  createTransaction,
  createPlannedExpense,
  createCsvImport,
  authHeader,
} = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
  jest.clearAllMocks();
  mockGetAuthedClient.mockResolvedValue({ fake: 'client' });
});

afterAll(async () => {
  await closeDb();
});

describe('reads never bleed across users', () => {
  it('GET /api/envelopes, /api/transactions, /api/planned-expenses, /api/forecast each see only the caller\'s own rows', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const ownerEnvelope = await createEnvelope({ user_id: owner.id, name: 'Owner Envelope', month: '2026-08-01' });
    await createTransaction({ user_id: owner.id, envelope_id: ownerEnvelope.id, transaction_date: '2026-08-05' });
    await createPlannedExpense({ user_id: owner.id, due_date: '2026-08-10' });
    const intruderEnvelope = await createEnvelope({ user_id: intruder.id, name: 'Intruder Envelope', month: '2026-08-01' });

    const envelopes = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(intruder));
    expect(envelopes.body.data).toEqual([expect.objectContaining({ id: intruderEnvelope.id })]);

    const transactions = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(intruder));
    expect(transactions.body.data).toEqual([]);

    const plannedExpenses = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader(intruder));
    expect(plannedExpenses.body.data).toEqual([]);

    const forecast = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(intruder));
    // Intruder's own envelope (budget 100000, no spend) — must not be
    // dragged down by owner's transaction/planned-expense.
    expect(forecast.body.data.projectedBalanceAgorot).toBe(100000);
  });

  it('GET /api/transactions?envelopeId=<foreign> returns an empty list, not the foreign envelope\'s rows', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const ownerEnvelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });
    await createTransaction({ user_id: owner.id, envelope_id: ownerEnvelope.id, transaction_date: '2026-08-05' });

    const res = await request(app)
      .get(`/api/transactions?month=2026-08&envelopeId=${ownerEnvelope.id}`)
      .set('Authorization', authHeader(intruder));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('a foreign :id is 404, and the row is left intact', () => {
  it('PATCH /api/envelopes/:id on a foreign id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const envelope = await createEnvelope({ user_id: owner.id, name: 'Original', month: '2026-08-01' });

    const res = await request(app)
      .patch(`/api/envelopes/${envelope.id}`)
      .set('Authorization', authHeader(intruder))
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);

    const check = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(owner));
    expect(check.body.data[0].name).toBe('Original');
  });

  it('DELETE /api/envelopes/:id on a foreign id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const envelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });

    const res = await request(app).delete(`/api/envelopes/${envelope.id}`).set('Authorization', authHeader(intruder));
    expect(res.status).toBe(404);

    const check = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(owner));
    expect(check.body.data).toHaveLength(1);
  });

  it('PATCH /api/transactions/:id on a foreign id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const transaction = await createTransaction({ user_id: owner.id, description: 'Original', transaction_date: '2026-08-05' });

    const res = await request(app)
      .patch(`/api/transactions/${transaction.id}`)
      .set('Authorization', authHeader(intruder))
      .send({ description: 'Hijacked' });
    expect(res.status).toBe(404);

    const check = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(owner));
    expect(check.body.data[0].description).toBe('Original');
  });

  it('DELETE /api/transactions/:id on a foreign id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const transaction = await createTransaction({ user_id: owner.id, transaction_date: '2026-08-05' });

    const res = await request(app).delete(`/api/transactions/${transaction.id}`).set('Authorization', authHeader(intruder));
    expect(res.status).toBe(404);

    const check = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(owner));
    expect(check.body.data).toHaveLength(1);
  });

  it('PATCH /api/planned-expenses/:id on a foreign id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const plannedExpense = await createPlannedExpense({ user_id: owner.id, title: 'Original', due_date: '2026-08-10' });

    const res = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(intruder))
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);

    const check = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader(owner));
    expect(check.body.data[0].title).toBe('Original');
  });

  it('DELETE /api/planned-expenses/:id on a foreign id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const plannedExpense = await createPlannedExpense({ user_id: owner.id, due_date: '2026-08-10' });

    const res = await request(app).delete(`/api/planned-expenses/${plannedExpense.id}`).set('Authorization', authHeader(intruder));
    expect(res.status).toBe(404);

    const check = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader(owner));
    expect(check.body.data).toHaveLength(1);
  });
});

describe('a foreign envelope_id in the request body is rejected, not silently accepted', () => {
  it('POST /api/transactions with a foreign envelope_id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const foreignEnvelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(intruder))
      .send({ envelope_id: foreignEnvelope.id, amount_agorot: 1500, description: 'Snack', transaction_date: '2026-08-05' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });

  it('PATCH /api/transactions/:id reassigning to a foreign envelope_id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const foreignEnvelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });
    const transaction = await createTransaction({ user_id: intruder.id, transaction_date: '2026-08-05' });

    const res = await request(app)
      .patch(`/api/transactions/${transaction.id}`)
      .set('Authorization', authHeader(intruder))
      .send({ envelope_id: foreignEnvelope.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });

  it('POST /api/planned-expenses with a foreign envelope_id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const foreignEnvelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });

    const res = await request(app)
      .post('/api/planned-expenses')
      .set('Authorization', authHeader(intruder))
      .send({ envelope_id: foreignEnvelope.id, title: 'Car service', amount_agorot: 45000, due_date: '2026-08-20' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });

  it('PATCH /api/planned-expenses/:id reassigning to a foreign envelope_id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const foreignEnvelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });
    const plannedExpense = await createPlannedExpense({ user_id: intruder.id, due_date: '2026-08-10' });

    const res = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(intruder))
      .send({ envelope_id: foreignEnvelope.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });
});

describe('every user-owned router rejects a missing or invalid token with 401', () => {
  it.each([
    ['GET', '/api/envelopes?month=2026-08'],
    ['GET', '/api/transactions?month=2026-08'],
    ['GET', '/api/planned-expenses?month=2026-08'],
    ['GET', '/api/forecast?month=2026-08'],
    ['GET', '/api/calendar/connect'],
    ['POST', '/api/calendar/sync'],
    ['POST', '/api/imports/preview'],
    ['GET', '/api/admin/users'],
  ])('%s %s', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = `Bearer ${jwt.sign({ sub: 1, role: 'user' }, 'not-the-real-secret', { expiresIn: '1h' })}`;
    const res = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', forged);
    expect(res.status).toBe(401);
  });
});

describe('admin routes never leak raw envelope/transaction/planned-expense rows', () => {
  it('a plain user gets 403 from every /api/admin/* sub-resource', async () => {
    const user = await createUser();

    const users = await request(app).get('/api/admin/users').set('Authorization', authHeader(user));
    const categories = await request(app).get('/api/admin/categories').set('Authorization', authHeader(user));
    const stats = await request(app).get('/api/admin/stats').set('Authorization', authHeader(user));

    expect(users.status).toBe(403);
    expect(categories.status).toBe(403);
    expect(stats.status).toBe(403);
  });

  it('an admin\'s user list and stats never include another user\'s envelope/transaction/planned-expense rows', async () => {
    const admin = await createUser({ role: 'admin' });
    const other = await createUser();
    const envelope = await createEnvelope({ user_id: other.id, month: '2026-08-01' });
    await createTransaction({ user_id: other.id, envelope_id: envelope.id, description: 'Secret purchase', transaction_date: '2026-08-05' });

    const users = await request(app).get('/api/admin/users').set('Authorization', authHeader(admin));
    const stats = await request(app).get('/api/admin/stats').set('Authorization', authHeader(admin));

    // The distinctive transaction description must never surface in either
    // response, and every user row must be exactly the public-attribute
    // shape — no nested envelope/transaction data ever joined in.
    expect(JSON.stringify(users.body)).not.toMatch(/Secret purchase/);
    expect(JSON.stringify(stats.body)).not.toMatch(/Secret purchase/);
    for (const row of users.body.data) {
      expect(Object.keys(row).sort()).toEqual(
        ['id', 'email', 'full_name', 'avatar_url', 'role', 'disabled', 'created_at'].sort()
      );
    }
  });
});

describe('calendar sync scopes google_event_id per user, not globally', () => {
  it('does not let one user\'s sync read or overwrite another user\'s planned expense for the same Google event id', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    // Both users are attendees of the same Google Calendar event — Google
    // assigns it the same event id for everyone. Owner has already synced it.
    const sharedEventId = 'shared-google-event-id';
    const ownedRow = await createPlannedExpense({
      user_id: owner.id,
      title: 'Rent ₪4500',
      amount_agorot: 450000,
      due_date: '2026-09-01',
      google_event_id: sharedEventId,
    });

    mockEventsList.mockResolvedValue({
      data: {
        items: [{ id: sharedEventId, summary: 'Rent ₪4500', start: { date: '2026-09-01' } }],
      },
    });

    const res = await request(app).post('/api/calendar/sync').set('Authorization', authHeader(intruder));

    expect(res.status).toBe(200);
    // Intruder gets their own row for the event, not a no-op against owner's.
    expect(res.body.data).toEqual({ newEvents: 1 });

    const ownerCheck = await request(app).get('/api/planned-expenses?month=2026-09').set('Authorization', authHeader(owner));
    expect(ownerCheck.body.data).toEqual([expect.objectContaining({ id: ownedRow.id, title: 'Rent ₪4500' })]);

    const intruderCheck = await request(app).get('/api/planned-expenses?month=2026-09').set('Authorization', authHeader(intruder));
    expect(intruderCheck.body.data).toHaveLength(1);
    expect(intruderCheck.body.data[0].id).not.toBe(ownedRow.id);
  });
});

describe('CSV import scopes dedup and confirm access per user', () => {
  const CSV_TEXT = 'Date,Amount,Description\n2026-08-05,34.00,Coffee\n';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('POST /api/imports/:id/confirm on a foreign import id returns 404', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const csvImport = await createCsvImport({ user_id: owner.id });
    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from(CSV_TEXT, 'utf8') });

    const res = await request(app)
      .post(`/api/imports/${csvImport.id}/confirm`)
      .set('Authorization', authHeader(intruder))
      .send({ mapping: { date: 'Date', amount: 'Amount', description: 'Description' } });

    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not let a byte-identical CSV from a different user get silently skipped as a duplicate', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const ownerImport = await createCsvImport({ user_id: owner.id });
    const intruderImport = await createCsvImport({ user_id: intruder.id });
    const mapping = { date: 'Date', amount: 'Amount', description: 'Description' };

    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from(CSV_TEXT, 'utf8') });
    const first = await request(app)
      .post(`/api/imports/${ownerImport.id}/confirm`)
      .set('Authorization', authHeader(owner))
      .send({ mapping });
    expect(first.body.data).toEqual({ imported: 1, duplicatesSkipped: 0 });

    // dedup_hash is salted with user_id (csvImportService.js computeDedupHash)
    // — an identical row from a different user must import as new, not be
    // treated as a re-import of the owner's row.
    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from(CSV_TEXT, 'utf8') });
    const second = await request(app)
      .post(`/api/imports/${intruderImport.id}/confirm`)
      .set('Authorization', authHeader(intruder))
      .send({ mapping });
    expect(second.body.data).toEqual({ imported: 1, duplicatesSkipped: 0 });

    const intruderTransactions = await request(app)
      .get('/api/transactions?month=2026-08')
      .set('Authorization', authHeader(intruder));
    expect(intruderTransactions.body.data).toHaveLength(1);
  });
});
