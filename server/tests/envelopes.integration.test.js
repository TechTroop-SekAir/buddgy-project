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
const { createUser, createEnvelope, createTransaction, createPlannedExpense, authHeader } = require('./helpers/fixtures');
const { sequelize, Envelope, Transaction } = require('../models');
const mergeDuplicateEnvelopes = require('../migrations/20260823000100-merge-duplicate-envelopes');

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

// Migration 20260823000100-merge-duplicate-envelopes.js — data repair for
// pairs split by 20260822000200's rename-on-collision logic. See
// docs/fixes/dup_envelopes.md.
describe('migration: merge-duplicate-envelopes', () => {
  const runMigration = () => mergeDuplicateEnvelopes.up(sequelize.getQueryInterface());

  it('merges a base/duplicate pair, summing budgets and keeping the base name and color', async () => {
    const user = await createUser();
    const base = await createEnvelope({
      user_id: user.id,
      name: 'מתנות',
      monthly_budget_agorot: 10000,
      color: '#111111',
      month: '2026-08-01',
    });
    await createEnvelope({
      user_id: user.id,
      name: 'מתנות (2)',
      monthly_budget_agorot: 5000,
      color: '#222222',
      month: '2026-08-01',
    });

    await runMigration();

    const remaining = await Envelope.findAll({ where: { user_id: user.id, month: '2026-08-01' } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      id: base.id,
      name: 'מתנות',
      monthly_budget_agorot: 15000,
      color: '#111111',
    });
  });

  it('re-points transactions and planned expenses off the duplicate before deleting it — zero rows flip to null', async () => {
    const user = await createUser();
    const base = await createEnvelope({ user_id: user.id, name: 'Groceries', month: '2026-08-01' });
    const dup = await createEnvelope({ user_id: user.id, name: 'Groceries (2)', month: '2026-08-01' });
    const tx = await createTransaction({ user_id: user.id, envelope_id: dup.id });
    const planned = await createPlannedExpense({ user_id: user.id, envelope_id: dup.id });

    await runMigration();

    await tx.reload();
    await planned.reload();
    expect(tx.envelope_id).toBe(base.id);
    expect(planned.envelope_id).toBe(base.id);

    const nullCount = await Transaction.count({ where: { envelope_id: null } });
    expect(nullCount).toBe(0);
  });

  it('merges a three-way group (name, name (2), name (3)) into one row summing all budgets', async () => {
    const user = await createUser();
    const base = await createEnvelope({ user_id: user.id, name: 'Fun', monthly_budget_agorot: 1000, month: '2026-08-01' });
    await createEnvelope({ user_id: user.id, name: 'Fun (2)', monthly_budget_agorot: 2000, month: '2026-08-01' });
    await createEnvelope({ user_id: user.id, name: 'Fun (3)', monthly_budget_agorot: 3000, month: '2026-08-01' });

    await runMigration();

    const remaining = await Envelope.findAll({ where: { user_id: user.id, month: '2026-08-01' } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: base.id, monthly_budget_agorot: 6000 });
  });

  it('is idempotent — running twice does not double-sum or error', async () => {
    const user = await createUser();
    const base = await createEnvelope({ user_id: user.id, name: 'Fun', monthly_budget_agorot: 1000, month: '2026-08-01' });
    await createEnvelope({ user_id: user.id, name: 'Fun (2)', monthly_budget_agorot: 2000, month: '2026-08-01' });

    await runMigration();
    await runMigration();

    const remaining = await Envelope.findAll({ where: { user_id: user.id, month: '2026-08-01' } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: base.id, monthly_budget_agorot: 3000 });
  });

  it('leaves a "(2)"-suffixed name untouched when no matching base row exists', async () => {
    const user = await createUser();
    const lone = await createEnvelope({ user_id: user.id, name: 'Standalone (2)', monthly_budget_agorot: 500, month: '2026-08-01' });

    await runMigration();

    const remaining = await Envelope.findAll({ where: { user_id: user.id, month: '2026-08-01' } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: lone.id, name: 'Standalone (2)', monthly_budget_agorot: 500 });
  });

  it('does not merge across different users or different months', async () => {
    const userA = await createUser();
    const userB = await createUser();
    await createEnvelope({ user_id: userA.id, name: 'Rent', monthly_budget_agorot: 1000, month: '2026-08-01' });
    await createEnvelope({ user_id: userB.id, name: 'Rent (2)', monthly_budget_agorot: 2000, month: '2026-08-01' });
    await createEnvelope({ user_id: userA.id, name: 'Rent', monthly_budget_agorot: 1000, month: '2026-09-01' });
    await createEnvelope({ user_id: userA.id, name: 'Rent (2)', monthly_budget_agorot: 2000, month: '2026-08-01' });

    await runMigration();

    // userA/2026-08 pair merges; userB's lone "(2)" (no base in its own
    // scope) and userA/2026-09's lone base survive untouched.
    const remaining = await Envelope.findAll();
    expect(remaining).toHaveLength(3);
    const userAAug = remaining.find((e) => e.user_id === userA.id && e.month === '2026-08-01');
    expect(userAAug.monthly_budget_agorot).toBe(3000);
  });
});
