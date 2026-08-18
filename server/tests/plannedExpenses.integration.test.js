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
const { createUser, createPlannedExpense, authHeader } = require('./helpers/fixtures');

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
});
