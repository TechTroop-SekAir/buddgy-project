'use strict';

// Real-Postgres integration tests for the planned-expenses DELETE endpoint.
// server/__tests__/plannedExpenses.test.js already covers GET/POST/PATCH/DELETE
// DB-mocked; this suite proves DELETE against real constraints/ownership.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createEnvelope, createPlannedExpense, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('DELETE /api/planned-expenses/:id', () => {
  it('deletes a planned expense', async () => {
    const user = await createUser();
    const plannedExpense = await createPlannedExpense({ user_id: user.id, due_date: '2026-08-20' });

    const res = await request(app)
      .delete(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: plannedExpense.id });

    const list = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader(user));
    expect(list.body.data).toEqual([]);
  });

  it('returns 404 for a foreign planned expense id', async () => {
    const owner = await createUser();
    const other = await createUser();
    const plannedExpense = await createPlannedExpense({ user_id: owner.id, due_date: '2026-08-20' });

    const res = await request(app)
      .delete(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(other));
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const user = await createUser();
    const plannedExpense = await createPlannedExpense({ user_id: user.id, due_date: '2026-08-20' });

    const res = await request(app).delete(`/api/planned-expenses/${plannedExpense.id}`);
    expect(res.status).toBe(401);
  });

  it('deleting a confirmed planned expense also deletes its linked transaction', async () => {
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
    expect(transactionId).not.toBeNull();

    const res = await request(app)
      .delete(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user));
    expect(res.status).toBe(200);

    const transactions = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(user));
    expect(transactions.body.data.find((t) => t.id === transactionId)).toBeUndefined();
  });
});

// Real-Postgres coverage for the atomic confirm/unconfirm behavior — proves
// the actual sequelize.transaction rollback and row-lock idempotency, which
// server/__tests__/plannedExpenses.test.js can only fake with mocks.
describe('PATCH /api/planned-expenses/:id — confirm creates a transaction', () => {
  it('confirming atomically creates a linked transaction that counts toward the envelope\'s spent amount', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, monthly_budget_agorot: 50000, month: '2026-08-01' });
    const plannedExpense = await createPlannedExpense({
      user_id: user.id,
      envelope_id: envelope.id,
      amount_agorot: 7000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });

    const res = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.is_confirmed).toBe(true);
    expect(res.body.data.transaction_id).not.toBeNull();

    const envelopes = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));
    const updated = envelopes.body.data.find((e) => e.id === envelope.id);
    expect(updated.spent_agorot).toBe(7000);
  });

  it('re-confirming an already-confirmed planned expense does not create a second transaction', async () => {
    const user = await createUser();
    const plannedExpense = await createPlannedExpense({
      user_id: user.id,
      amount_agorot: 5000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });

    const first = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });

    const second = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });

    expect(second.status).toBe(200);
    expect(second.body.data.transaction_id).toBe(first.body.data.transaction_id);

    const transactions = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(user));
    expect(transactions.body.data).toHaveLength(1);
  });

  it('unconfirming deletes the linked transaction', async () => {
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
    expect(confirmed.body.data.transaction_id).not.toBeNull();

    const unconfirmed = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: false });

    expect(unconfirmed.status).toBe(200);
    expect(unconfirmed.body.data.transaction_id).toBe(null);

    const transactions = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(user));
    expect(transactions.body.data).toHaveLength(0);
  });

  it('rejects confirming an amount-less planned expense', async () => {
    const user = await createUser();
    const plannedExpense = await createPlannedExpense({
      user_id: user.id,
      amount_agorot: null,
      due_date: '2026-08-18',
      is_confirmed: false,
    });

    const res = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: amount_agorot');
  });

  it('reassigning an already-confirmed row moves its linked transaction\'s envelope spend, not just the row', async () => {
    const user = await createUser();
    const fromEnvelope = await createEnvelope({ user_id: user.id, name: 'From', monthly_budget_agorot: 50000, month: '2026-08-01' });
    const toEnvelope = await createEnvelope({ user_id: user.id, name: 'To', monthly_budget_agorot: 50000, month: '2026-08-01' });
    const plannedExpense = await createPlannedExpense({
      user_id: user.id,
      envelope_id: fromEnvelope.id,
      amount_agorot: 7000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });
    await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });

    const res = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(user))
      .send({ envelope_id: toEnvelope.id });
    expect(res.status).toBe(200);
    expect(res.body.data.envelope_id).toBe(toEnvelope.id);

    const envelopes = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));
    const from = envelopes.body.data.find((e) => e.id === fromEnvelope.id);
    const to = envelopes.body.data.find((e) => e.id === toEnvelope.id);
    expect(from.spent_agorot).toBe(0);
    expect(to.spent_agorot).toBe(7000);
  });

  it('a failed confirm (foreign envelope) leaves neither the row nor a transaction changed', async () => {
    const owner = await createUser();
    const other = await createUser();
    const foreignEnvelope = await createEnvelope({ user_id: other.id, monthly_budget_agorot: 50000, month: '2026-08-01' });
    const plannedExpense = await createPlannedExpense({
      user_id: owner.id,
      amount_agorot: 5000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });

    const res = await request(app)
      .patch(`/api/planned-expenses/${plannedExpense.id}`)
      .set('Authorization', authHeader(owner))
      .send({ envelope_id: foreignEnvelope.id, is_confirmed: true });

    expect(res.status).toBe(400);

    const list = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader(owner));
    const unchanged = list.body.data.find((p) => p.id === plannedExpense.id);
    expect(unchanged.is_confirmed).toBe(false);
    expect(unchanged.transaction_id).toBe(null);

    const transactions = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader(owner));
    expect(transactions.body.data).toHaveLength(0);
  });
});
