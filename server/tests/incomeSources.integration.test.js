'use strict';

// Real-Postgres integration tests for GET/PUT /api/income-sources — backs
// the onboarding wizard's income step (client/src/components/onboarding/
// IncomeStep.jsx), previously localStorage-only (mockIncomeService.js).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/income-sources', () => {
  it('returns an empty month as { rows: [], total_agorot: 0 }, never null/undefined', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/income-sources?month=2026-08').set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ rows: [], total_agorot: 0 });
  });

  it('rejects a malformed month', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/income-sources?month=nope').set('Authorization', authHeader(user));
    expect(res.status).toBe(400);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/income-sources?month=2026-08');
    expect(res.status).toBe(401);
  });

  it('never returns another user\'s income sources', async () => {
    const owner = await createUser();
    const other = await createUser();
    await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(owner))
      .send({ month: '2026-08', rows: [{ label: 'Salary', amount_agorot: 1500000 }] });

    const res = await request(app).get('/api/income-sources?month=2026-08').set('Authorization', authHeader(other));
    expect(res.body.data).toEqual({ rows: [], total_agorot: 0 });
  });
});

describe('PUT /api/income-sources', () => {
  it('replaces a month wholesale, preserving row order and summing the total', async () => {
    const user = await createUser();

    const res = await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({
        month: '2026-08',
        rows: [
          { label: 'Salary', amount_agorot: 1500000 },
          { label: 'Freelance', amount_agorot: 300000 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.total_agorot).toBe(1800000);
    expect(res.body.data.rows.map((r) => r.label)).toEqual(['Salary', 'Freelance']);
    expect(res.body.data.rows.every((r) => r.user_id === user.id)).toBe(true);

    const list = await request(app).get('/api/income-sources?month=2026-08').set('Authorization', authHeader(user));
    expect(list.body.data.total_agorot).toBe(1800000);
  });

  it('a second PUT fully replaces the first — no leftover rows from the earlier call', async () => {
    const user = await createUser();
    await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [{ label: 'Old', amount_agorot: 100000 }] });

    const res = await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [{ label: 'New', amount_agorot: 200000 }] });

    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0]).toMatchObject({ label: 'New', amount_agorot: 200000 });
    expect(res.body.data.total_agorot).toBe(200000);
  });

  it('an empty rows array clears the month', async () => {
    const user = await createUser();
    await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [{ label: 'Salary', amount_agorot: 1500000 }] });

    const res = await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [] });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ rows: [], total_agorot: 0 });
  });

  it('does not touch a different month\'s rows', async () => {
    const user = await createUser();
    await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-07', rows: [{ label: 'July income', amount_agorot: 100000 }] });

    await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [{ label: 'August income', amount_agorot: 200000 }] });

    const july = await request(app).get('/api/income-sources?month=2026-07').set('Authorization', authHeader(user));
    expect(july.body.data.total_agorot).toBe(100000);
  });

  it('rejects a non-positive amount', async () => {
    const user = await createUser();
    const res = await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [{ label: 'Salary', amount_agorot: 0 }] });
    expect(res.status).toBe(400);
  });

  it('rejects a missing label', async () => {
    const user = await createUser();
    const res = await request(app)
      .put('/api/income-sources')
      .set('Authorization', authHeader(user))
      .send({ month: '2026-08', rows: [{ amount_agorot: 100000 }] });
    expect(res.status).toBe(400);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app)
      .put('/api/income-sources')
      .send({ month: '2026-08', rows: [] });
    expect(res.status).toBe(401);
  });
});
