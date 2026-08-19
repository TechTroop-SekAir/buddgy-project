'use strict';

// Real-Postgres integration tests for ticket B-05 (transaction CRUD).
// POST /api/transactions/parse also lives in this router — server/routes/
// transactions.js's own comment: "this file also becomes home to Matan's
// transaction CRUD (B-05) — only /parse belongs to C-02" — so it gets one
// minimal wiring test here (auth + mocked-Claude happy path), not deep
// AI-behavior coverage; that's C-02/C-03's territory.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mockParseQuickEntry = jest.fn();
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: (...args) => mockParseQuickEntry(...args),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createEnvelope, createTransaction, createPlannedExpense, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
  mockParseQuickEntry.mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/transactions', () => {
  it('lists the caller\'s transactions for the month, filterable by envelope', async () => {
    const user = await createUser();
    const groceries = await createEnvelope({ user_id: user.id, month: '2026-08-01' });
    const entertainment = await createEnvelope({ user_id: user.id, name: 'Fun', month: '2026-08-01' });
    await createTransaction({ user_id: user.id, envelope_id: groceries.id, amount_agorot: 3400, transaction_date: '2026-08-05' });
    await createTransaction({ user_id: user.id, envelope_id: entertainment.id, amount_agorot: 2000, transaction_date: '2026-08-06' });
    await createTransaction({ user_id: user.id, envelope_id: groceries.id, amount_agorot: 999, transaction_date: '2026-07-31' });

    const month = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(user));
    expect(month.body.data).toHaveLength(2);

    const filtered = await request(app)
      .get(`/api/transactions?month=2026-08&envelopeId=${groceries.id}`)
      .set('Authorization', authHeader(user));
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].amount_agorot).toBe(3400);
  });

  it('rejects a malformed month', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/transactions?month=nope').set('Authorization', authHeader(user));
    expect(res.status).toBe(400);
  });

  it('never returns another user\'s transactions', async () => {
    const owner = await createUser();
    const other = await createUser();
    await createTransaction({ user_id: owner.id, transaction_date: '2026-08-05' });

    const res = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(other));
    expect(res.body.data).toEqual([]);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/transactions?month=2026-08');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/transactions', () => {
  it('creates an unassigned (envelope_id: null) transaction', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(user))
      .send({ amount_agorot: 1500, description: 'Snack', transaction_date: '2026-08-05' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ envelope_id: null, amount_agorot: 1500, source: 'manual' });
  });

  it('rejects an envelope_id belonging to another user, via the real FK-adjacent ownership check', async () => {
    const user = await createUser();
    const other = await createUser();
    const foreignEnvelope = await createEnvelope({ user_id: other.id, month: '2026-08-01' });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(user))
      .send({ envelope_id: foreignEnvelope.id, amount_agorot: 1500, description: 'Snack', transaction_date: '2026-08-05' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });

  it('rejects a nonexistent envelope_id', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(user))
      .send({ envelope_id: 999999, amount_agorot: 1500, description: 'Snack', transaction_date: '2026-08-05' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/transactions/:id', () => {
  it('partially updates a transaction', async () => {
    const user = await createUser();
    const transaction = await createTransaction({ user_id: user.id, description: 'Old', transaction_date: '2026-08-05' });

    const res = await request(app)
      .patch(`/api/transactions/${transaction.id}`)
      .set('Authorization', authHeader(user))
      .send({ description: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('New');
  });

  it('returns 404, not another user\'s data, for a foreign transaction id', async () => {
    const owner = await createUser();
    const other = await createUser();
    const transaction = await createTransaction({ user_id: owner.id, transaction_date: '2026-08-05' });

    const res = await request(app)
      .patch(`/api/transactions/${transaction.id}`)
      .set('Authorization', authHeader(other))
      .send({ description: 'Hijacked' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('deletes a transaction', async () => {
    const user = await createUser();
    const transaction = await createTransaction({ user_id: user.id, transaction_date: '2026-08-05' });

    const res = await request(app).delete(`/api/transactions/${transaction.id}`).set('Authorization', authHeader(user));
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(user));
    expect(list.body.data).toEqual([]);
  });

  it('returns 404 for a foreign transaction id', async () => {
    const owner = await createUser();
    const other = await createUser();
    const transaction = await createTransaction({ user_id: owner.id, transaction_date: '2026-08-05' });

    const res = await request(app).delete(`/api/transactions/${transaction.id}`).set('Authorization', authHeader(other));
    expect(res.status).toBe(404);
  });

  it('deleting the transaction a confirm created reverts the planned expense to unconfirmed', async () => {
    const user = await createUser();
    const plannedExpense = await createPlannedExpense({
      user_id: user.id,
      amount_agorot: 5000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });
    const confirmed = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });
    const transactionId = confirmed.body.data.transaction_id;

    const res = await request(app).delete(`/api/transactions/${transactionId}`).set('Authorization', authHeader(user));
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader(user));
    const reverted = list.body.data.find((p) => p.id === plannedExpense.id);
    expect(reverted.is_confirmed).toBe(false);
    expect(reverted.transaction_id).toBe(null);

    // Re-confirmable now that it's unconfirmed again — proves the row isn't
    // stuck (the pre-fix bug: is_confirmed: true, transaction_id: null).
    const reconfirmed = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });
    expect(reconfirmed.status).toBe(200);
    expect(reconfirmed.body.data.transaction_id).not.toBeNull();
  });
});

describe('POST /api/transactions/parse (minimal wiring only — see file header)', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/transactions/parse').send({ text: 'coffee, 20 shekels' });
    expect(res.status).toBe(401);
  });

  it('returns the structured suggestion from claudeService (mocked) for an authenticated caller', async () => {
    const user = await createUser();
    mockParseQuickEntry.mockResolvedValue({
      amount_agorot: 2000,
      category: 'Cafes & Restaurants',
      suggested_envelope_id: null,
      description: 'Coffee',
      transaction_date: '2026-08-05',
      confidence: 0.9,
    });

    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader(user))
      .send({ text: 'coffee, 20 shekels' });

    expect(res.status).toBe(200);
    expect(res.body.data.amount_agorot).toBe(2000);
    // Real DB proof this endpoint is wired to the real, authenticated caller —
    // not just that the mock was called with *something*.
    expect(mockParseQuickEntry).toHaveBeenCalledWith(user.id, 'coffee, 20 shekels', expect.any(Array));
  });
});
