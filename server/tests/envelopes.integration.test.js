'use strict';

// Real-Postgres integration tests for ticket B-05 (envelope CRUD).
// server/__tests__/envelopes.test.js already covers this DB-mocked; this
// suite proves the same behavior against real constraints and the real
// grouped-SUM aggregation in server/services/envelopeService.js.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createEnvelope, createTransaction, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/envelopes', () => {
  it('lists the caller\'s envelopes with spent_agorot computed from in-month transactions only', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, name: 'Groceries', monthly_budget_agorot: 100000, month: '2026-08-01' });
    await createTransaction({ user_id: user.id, envelope_id: envelope.id, amount_agorot: 3400, transaction_date: '2026-08-05' });
    await createTransaction({ user_id: user.id, envelope_id: envelope.id, amount_agorot: 5000, transaction_date: '2026-08-20' });
    // Outside the requested month — must NOT be counted.
    await createTransaction({ user_id: user.id, envelope_id: envelope.id, amount_agorot: 99999, transaction_date: '2026-07-31' });

    const res = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: envelope.id, name: 'Groceries', spent_agorot: 8400 });
  });

  it('returns 0 spent_agorot, never null, for an envelope with no transactions', async () => {
    const user = await createUser();
    await createEnvelope({ user_id: user.id, month: '2026-08-01' });

    const res = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));

    expect(res.body.data[0].spent_agorot).toBe(0);
  });

  it('returns an empty array for a month with no envelopes', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/envelopes?month=2026-09').set('Authorization', authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('treats the YYYY-MM shorthand and YYYY-MM-01 as the same month', async () => {
    const user = await createUser();
    await createEnvelope({ user_id: user.id, month: '2026-08-01' });

    const shortForm = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));
    const longForm = await request(app).get('/api/envelopes?month=2026-08-01').set('Authorization', authHeader(user));

    expect(shortForm.body.data).toHaveLength(1);
    expect(shortForm.body.data).toEqual(longForm.body.data);
  });

  it('rejects a malformed month', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/envelopes?month=not-a-month').set('Authorization', authHeader(user));
    expect(res.status).toBe(400);
  });

  it('never returns another user\'s envelopes', async () => {
    const owner = await createUser();
    const other = await createUser();
    await createEnvelope({ user_id: owner.id, month: '2026-08-01' });

    const res = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(other));
    expect(res.body.data).toEqual([]);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/envelopes?month=2026-08');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/envelopes', () => {
  it('creates an envelope with spent_agorot: 0', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader(user))
      .send({ name: 'Entertainment', monthly_budget_agorot: 50000, month: '2026-08' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Entertainment', monthly_budget_agorot: 50000, spent_agorot: 0 });
    // Persisted for real — a fresh GET must see it, not just the create response.
    const list = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));
    expect(list.body.data).toHaveLength(1);
  });

  it('rejects a missing name', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader(user))
      .send({ monthly_budget_agorot: 50000, month: '2026-08' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive budget', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader(user))
      .send({ name: 'Bad', monthly_budget_agorot: 0, month: '2026-08' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/envelopes/:id', () => {
  it('partially updates an envelope', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, name: 'Old Name', month: '2026-08-01' });

    const res = await request(app)
      .patch(`/api/envelopes/${envelope.id}`)
      .set('Authorization', authHeader(user))
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('rejects an empty body', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, month: '2026-08-01' });
    const res = await request(app).patch(`/api/envelopes/${envelope.id}`).set('Authorization', authHeader(user)).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404, not another user\'s data, for a foreign envelope id', async () => {
    const owner = await createUser();
    const other = await createUser();
    const envelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });

    const res = await request(app)
      .patch(`/api/envelopes/${envelope.id}`)
      .set('Authorization', authHeader(other))
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const user = await createUser();
    const res = await request(app).patch('/api/envelopes/999999').set('Authorization', authHeader(user)).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/envelopes/:id', () => {
  it('deletes an envelope', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, month: '2026-08-01' });

    const res = await request(app).delete(`/api/envelopes/${envelope.id}`).set('Authorization', authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: envelope.id });

    const list = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(user));
    expect(list.body.data).toEqual([]);
  });

  it('returns 404 for a foreign envelope id and leaves it intact', async () => {
    const owner = await createUser();
    const other = await createUser();
    const envelope = await createEnvelope({ user_id: owner.id, month: '2026-08-01' });

    const res = await request(app).delete(`/api/envelopes/${envelope.id}`).set('Authorization', authHeader(other));
    expect(res.status).toBe(404);

    const list = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader(owner));
    expect(list.body.data).toHaveLength(1);
  });
});
