'use strict';

// Real-Postgres integration tests for ticket B-08 (admin users + stats).
// The most valuable case here is real, end-to-end: disable a user through
// the actual PATCH /api/admin/users/:id endpoint, then prove a completely
// separate, already-issued token for that user is rejected by the real
// requireAuth DB lookup on the very next request — something a DB-mocked
// test (server/__tests__/adminUsers.test.js) can only simulate by hand.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { AiCall } = require('../models');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createTransaction, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/admin/users', () => {
  it('lists users without ever exposing password_hash or google_refresh_token', async () => {
    const admin = await createUser({ role: 'admin' });
    await createUser({ email: 'plain@test.buddgy.com' });

    const res = await request(app).get('/api/admin/users').set('Authorization', authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password_hash/);
    expect(raw).not.toMatch(/google_refresh_token/);
  });

  it('rejects a non-admin with 403', async () => {
    const user = await createUser({ role: 'user' });
    const res = await request(app).get('/api/admin/users').set('Authorization', authHeader(user));
    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/admin/users/:id', () => {
  it('disables a user, then re-enables them', async () => {
    const admin = await createUser({ role: 'admin' });
    const target = await createUser({ email: 'target@test.buddgy.com' });

    const disable = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set('Authorization', authHeader(admin))
      .send({ disabled: true });
    expect(disable.status).toBe(200);
    expect(disable.body.data).toEqual({ id: target.id, disabled: true });

    const enable = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set('Authorization', authHeader(admin))
      .send({ disabled: false });
    expect(enable.status).toBe(200);
    expect(enable.body.data).toEqual({ id: target.id, disabled: false });
  });

  it('revokes a target user\'s already-issued token, end to end, the moment they are disabled', async () => {
    const admin = await createUser({ role: 'admin' });
    const target = await createUser({ email: 'revoke-target@test.buddgy.com' });
    const targetHeader = authHeader(target);

    const before = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', targetHeader);
    expect(before.status).toBe(200);

    const disable = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set('Authorization', authHeader(admin))
      .send({ disabled: true });
    expect(disable.status).toBe(200);

    const after = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', targetHeader);
    expect(after.status).toBe(401);
  });

  it('rejects an admin disabling their own account, and leaves them enabled', async () => {
    const admin = await createUser({ role: 'admin' });

    const res = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set('Authorization', authHeader(admin))
      .send({ disabled: true });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ data: null, error: 'cannot disable your own account' });

    // Still enabled, still able to authenticate — the guard didn't half-apply.
    const stillWorks = await request(app).get('/api/admin/users').set('Authorization', authHeader(admin));
    expect(stillWorks.status).toBe(200);
  });

  it('returns 404 for an unknown id', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app)
      .patch('/api/admin/users/999999')
      .set('Authorization', authHeader(admin))
      .send({ disabled: true });
    expect(res.status).toBe(404);
  });

  it('rejects a missing or invalid disabled value', async () => {
    const admin = await createUser({ role: 'admin' });
    const target = await createUser();

    const empty = await request(app).patch(`/api/admin/users/${target.id}`).set('Authorization', authHeader(admin)).send({});
    expect(empty.status).toBe(400);

    const wrongType = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set('Authorization', authHeader(admin))
      .send({ disabled: 'yes' });
    expect(wrongType.status).toBe(400);
  });

  it('rejects a non-admin with 403', async () => {
    const user = await createUser({ role: 'user' });
    const target = await createUser();
    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set('Authorization', authHeader(user))
      .send({ disabled: true });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/stats', () => {
  it('returns real counts from real rows', async () => {
    const admin = await createUser({ role: 'admin' });
    await createUser();
    await createUser();
    await createTransaction({ user_id: admin.id, transaction_date: '2026-08-01' });
    await createTransaction({ user_id: admin.id, transaction_date: '2026-08-02' });
    await createTransaction({ user_id: admin.id, transaction_date: '2026-08-03' });
    await AiCall.create({ user_id: admin.id, kind: 'quick_entry', succeeded: true });
    await AiCall.create({ user_id: admin.id, kind: 'csv_mapping', succeeded: false });

    const res = await request(app).get('/api/admin/stats').set('Authorization', authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userCount: 3, transactionCount: 3, aiCallCount: 2 });
  });

  it('counts a failed AI call the same as a successful one', async () => {
    const admin = await createUser({ role: 'admin' });
    await AiCall.create({ user_id: admin.id, kind: 'quick_entry', succeeded: false });

    const res = await request(app).get('/api/admin/stats').set('Authorization', authHeader(admin));
    expect(res.body.data.aiCallCount).toBe(1);
  });

  it('keeps aiCallCount after the logging user is deleted (ON DELETE SET NULL, not CASCADE)', async () => {
    const admin = await createUser({ role: 'admin' });
    const loggedBy = await createUser();
    await AiCall.create({ user_id: loggedBy.id, kind: 'quick_entry', succeeded: true });

    await loggedBy.destroy();

    const res = await request(app).get('/api/admin/stats').set('Authorization', authHeader(admin));
    expect(res.body.data.aiCallCount).toBe(1);
  });

  it('rejects a non-admin with 403', async () => {
    const user = await createUser({ role: 'user' });
    const res = await request(app).get('/api/admin/stats').set('Authorization', authHeader(user));
    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });
});
