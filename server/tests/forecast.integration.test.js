'use strict';

// Real-Postgres integration tests for ticket B-07 (forecast computation).
// server/__tests__/forecast.test.js already covers this DB-mocked with
// hand-crafted SUM rows; this suite proves the real grouped-aggregate SQL in
// server/services/forecastService.js against actual rows, including the
// COALESCE-to-0 empty-aggregate behavior real Postgres exhibits (the exact
// thing a mock has to fake by hand).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createEnvelope, createTransaction, createPlannedExpense, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/forecast', () => {
  it('computes the projected balance, at-risk envelopes, and a recommendation from real rows', async () => {
    const user = await createUser();
    const food = await createEnvelope({ user_id: user.id, name: 'Food', monthly_budget_agorot: 100000, month: '2026-08-01' });
    const fun = await createEnvelope({ user_id: user.id, name: 'Entertainment', monthly_budget_agorot: 50000, month: '2026-08-01' });
    await createTransaction({ user_id: user.id, envelope_id: food.id, amount_agorot: 60000, transaction_date: '2026-08-05' });
    await createTransaction({ user_id: user.id, envelope_id: fun.id, amount_agorot: 30000, transaction_date: '2026-08-06' });
    await createPlannedExpense({
      user_id: user.id,
      envelope_id: fun.id,
      amount_agorot: 70000,
      due_date: '2026-08-20',
      is_confirmed: true,
    });

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
    // budget 150000 - actual 90000 - planned 70000
    expect(res.body.data.projectedBalanceAgorot).toBe(-10000);
    // Entertainment: 50000 - 30000 - 70000 = -50000 < 0
    expect(res.body.data.atRiskEnvelopes).toEqual([fun.id]);
    // Food has the only headroom (100000 - 60000 = 40000); cut capped at the shortfall
    expect(res.body.data.recommendation).toEqual({ envelopeId: food.id, envelopeName: 'Food', cutAgorot: 10000 });
    expect(res.body.data.totalActualSpentAgorot).toBe(90000);
    expect(res.body.data.totalPlannedExpensesAgorot).toBe(70000);
  });

  it('degrades gracefully to the zero contract with no envelopes and no activity (real COALESCE, not a mocked SUM row)', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      projectedBalanceAgorot: 0,
      atRiskEnvelopes: [],
      recommendation: null,
      totalActualSpentAgorot: 0,
      totalPlannedExpensesAgorot: 0,
      totalEndOfMonthSpendAgorot: 0,
      totalBudgetAgorot: 0,
      missingAmountPlannedExpenses: [],
    });
  });

  it('only counts confirmed planned expenses', async () => {
    const user = await createUser();
    await createEnvelope({ user_id: user.id, monthly_budget_agorot: 100000, month: '2026-08-01' });
    await createPlannedExpense({ user_id: user.id, amount_agorot: 50000, due_date: '2026-08-10', is_confirmed: false });

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.body.data.totalPlannedExpensesAgorot).toBe(0);
    expect(res.body.data.projectedBalanceAgorot).toBe(100000);
  });

  it('confirming a planned expense via the endpoint counts it once as actual spend, not also as planned', async () => {
    const user = await createUser();
    const food = await createEnvelope({ user_id: user.id, name: 'Food', monthly_budget_agorot: 100000, month: '2026-08-01' });
    const bill = await createPlannedExpense({
      user_id: user.id,
      envelope_id: food.id,
      amount_agorot: 30000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });

    const confirmRes = await request(app)
      .patch(`/api/planned-expenses/${bill.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.transaction_id).not.toBeNull();

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.body.data.totalActualSpentAgorot).toBe(30000);
    // Not double-counted — the confirmed row is now linked to a real
    // transaction, so it's excluded from the "planned" sum.
    expect(res.body.data.totalPlannedExpensesAgorot).toBe(0);
    expect(res.body.data.totalEndOfMonthSpendAgorot).toBe(30000);
    expect(res.body.data.projectedBalanceAgorot).toBe(70000);
  });

  it('a confirmed planned expense not yet linked to a transaction is still counted as planned (legacy/manual state)', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, monthly_budget_agorot: 100000, month: '2026-08-01' });
    // Constructed directly via the fixture, bypassing the PATCH endpoint —
    // simulates a row confirmed before the transaction_id link existed.
    await createPlannedExpense({
      user_id: user.id,
      envelope_id: envelope.id,
      amount_agorot: 40000,
      due_date: '2026-08-18',
      is_confirmed: true,
      transaction_id: null,
    });

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.body.data.totalActualSpentAgorot).toBe(0);
    expect(res.body.data.totalPlannedExpensesAgorot).toBe(40000);
  });

  it('deleting a confirm-created transaction drops both actual and planned totals, not one while the other rises', async () => {
    const user = await createUser();
    const food = await createEnvelope({ user_id: user.id, name: 'Food', monthly_budget_agorot: 100000, month: '2026-08-01' });
    const bill = await createPlannedExpense({
      user_id: user.id,
      envelope_id: food.id,
      amount_agorot: 30000,
      due_date: '2026-08-18',
      is_confirmed: false,
    });
    const confirmRes = await request(app)
      .patch(`/api/planned-expenses/${bill.id}`)
      .set('Authorization', authHeader(user))
      .send({ is_confirmed: true });
    const transactionId = confirmRes.body.data.transaction_id;

    await request(app).delete(`/api/transactions/${transactionId}`).set('Authorization', authHeader(user));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    // Pre-fix bug: totalActualSpentAgorot dropped to 0 but totalPlannedExpensesAgorot
    // rose to 30000 (the ON DELETE SET NULL left is_confirmed: true, transaction_id:
    // null, which matched the "planned" filter) — net effect on the forecast was
    // zero, so the delete appeared to do nothing. Both must be 0 now: the revert
    // in transactionService.js's remove() also flips is_confirmed to false.
    expect(res.body.data.totalActualSpentAgorot).toBe(0);
    expect(res.body.data.totalPlannedExpensesAgorot).toBe(0);
    expect(res.body.data.totalEndOfMonthSpendAgorot).toBe(0);
    expect(res.body.data.projectedBalanceAgorot).toBe(100000);
  });

  it('counts an unassigned transaction toward the overall total but not against any envelope', async () => {
    const user = await createUser();
    const envelope = await createEnvelope({ user_id: user.id, monthly_budget_agorot: 20000, month: '2026-08-01' });
    await createTransaction({ user_id: user.id, envelope_id: envelope.id, amount_agorot: 20000, transaction_date: '2026-08-05' });
    await createTransaction({ user_id: user.id, envelope_id: null, amount_agorot: 30000, transaction_date: '2026-08-06' });

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.body.data.projectedBalanceAgorot).toBe(-30000); // 20000 - 50000
    // Envelope's own headroom (20000 - 20000 = 0) isn't dragged negative by the unassigned row.
    expect(res.body.data.atRiskEnvelopes).toEqual([]);
  });

  it('surfaces planned expenses missing an amount, within the month', async () => {
    const user = await createUser();
    await createPlannedExpense({ user_id: user.id, title: 'Unknown event', amount_agorot: null, due_date: '2026-08-15' });
    await createPlannedExpense({ user_id: user.id, title: 'Zero amount', amount_agorot: 0, due_date: '2026-08-16' });
    await createPlannedExpense({ user_id: user.id, title: 'Has amount', amount_agorot: 5000, due_date: '2026-08-17' });

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(user));

    expect(res.body.data.missingAmountPlannedExpenses).toHaveLength(2);
    expect(res.body.data.missingAmountPlannedExpenses.map((p) => p.title).sort()).toEqual(['Unknown event', 'Zero amount']);
  });

  it('rejects a malformed month', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/forecast?month=banana').set('Authorization', authHeader(user));
    expect(res.status).toBe(400);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/forecast?month=2026-08');
    expect(res.status).toBe(401);
  });

  it('never mixes another user\'s envelopes/transactions into the forecast', async () => {
    const owner = await createUser();
    const other = await createUser();
    await createEnvelope({ user_id: other.id, monthly_budget_agorot: 999999, month: '2026-08-01' });

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(owner));
    expect(res.body.data.projectedBalanceAgorot).toBe(0);
  });
});
