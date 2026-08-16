'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// app.js pulls in routes/transactions.js -> controllers/transactionsController.js
// -> services/claudeService.js, which requires the ESM-only `ai` package —
// Jest can't parse it un-mocked. Same fix as __tests__/plannedExpenses.test.js.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const mockEnvelopeFindAll = jest.fn();
const mockTransactionFindAll = jest.fn();
const mockPlannedExpenseFindAll = jest.fn();

// Mock at the models boundary, same shape as __tests__/plannedExpenses.test.js —
// DB stays mocked; CI's real Postgres run covers the actual schema.
jest.mock('../models', () => ({
  Envelope: { findAll: (...args) => mockEnvelopeFindAll(...args) },
  Transaction: { findAll: (...args) => mockTransactionFindAll(...args) },
  PlannedExpense: { findAll: (...args) => mockPlannedExpenseFindAll(...args) },
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const AUTHED_USER_ID = 1;

function authHeader(userId = AUTHED_USER_ID) {
  const token = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

/** A non-grouped SUM query (attributes: [[COALESCE(SUM(col)), 'total']]) always returns exactly one row in real Postgres, even with zero matches. */
function overallSumRow(total) {
  return [{ total: String(total) }];
}

/** A grouped-by-envelope_id SUM query — one row per envelope with a match, none if nothing matches. */
function groupedSumRows(byEnvelopeId) {
  return Object.entries(byEnvelopeId).map(([envelope_id, total]) => ({
    envelope_id: Number(envelope_id),
    total: String(total),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/forecast', () => {
  it('computes the projected balance, at-risk envelopes, and a recommendation', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([
      { id: 1, name: 'Food', monthly_budget_agorot: 100000 },
      { id: 2, name: 'Entertainment', monthly_budget_agorot: 50000 },
    ]);
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(90000)) // overall actual
      .mockResolvedValueOnce(groupedSumRows({ 1: 60000, 2: 30000 })); // per-envelope spent
    mockPlannedExpenseFindAll
      .mockResolvedValueOnce(overallSumRow(70000)) // overall confirmed planned
      .mockResolvedValueOnce(groupedSumRows({ 2: 70000 })); // per-envelope confirmed planned

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        // budget 150000 - actual 90000 - planned 70000
        projectedBalanceAgorot: -10000,
        // envelope 2: 50000 - 30000 - 70000 = -50000 < 0
        atRiskEnvelopes: [2],
        // envelope 1 has the most headroom (100000 - 60000 = 40000); cut is capped at the shortfall
        recommendation: { envelopeId: 1, envelopeName: 'Food', cutAgorot: 10000 },
      },
      error: null,
    });
  });

  it('degrades gracefully to the zero contract when the user has no envelopes', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([]);
    mockTransactionFindAll.mockResolvedValueOnce(overallSumRow(0));
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { projectedBalanceAgorot: 0, atRiskEnvelopes: [], recommendation: null },
      error: null,
    });
    // Zero envelopes short-circuits before the per-envelope grouped queries.
    expect(mockTransactionFindAll).toHaveBeenCalledTimes(1);
    expect(mockPlannedExpenseFindAll).toHaveBeenCalledTimes(1);
  });

  it('handles zero planned expenses for the month without throwing', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([{ id: 1, name: 'Food', monthly_budget_agorot: 100000 }]);
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(40000))
      .mockResolvedValueOnce(groupedSumRows({ 1: 40000 }));
    mockPlannedExpenseFindAll
      .mockResolvedValueOnce(overallSumRow(0))
      .mockResolvedValueOnce(groupedSumRows({}));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      projectedBalanceAgorot: 60000, // 100000 - 40000 - 0
      atRiskEnvelopes: [],
      recommendation: null,
    });
  });

  it('counts an unassigned transaction toward the overall projection but not against any envelope', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([{ id: 1, name: 'Food', monthly_budget_agorot: 20000 }]);
    // 20000 spent on envelope 1, plus a 30000 unassigned transaction — overall includes both.
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(50000))
      .mockResolvedValueOnce(groupedSumRows({ 1: 20000 })); // grouped query excludes envelope_id IS NULL
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.projectedBalanceAgorot).toBe(-30000); // 20000 - 50000
    // Envelope 1's own headroom (20000 - 20000 = 0) isn't dragged negative by the unassigned row.
    expect(res.body.data.atRiskEnvelopes).toEqual([]);
  });

  it('only counts confirmed planned expenses', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([{ id: 1, name: 'Food', monthly_budget_agorot: 100000 }]);
    mockTransactionFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));

    await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    const [overallWhere] = mockPlannedExpenseFindAll.mock.calls[0];
    const [groupedWhere] = mockPlannedExpenseFindAll.mock.calls[1];
    expect(overallWhere.where.is_confirmed).toBe(true);
    expect(groupedWhere.where.is_confirmed).toBe(true);
  });

  it('returns a null recommendation when the projection is positive', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([{ id: 1, name: 'Food', monthly_budget_agorot: 100000 }]);
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(10000))
      .mockResolvedValueOnce(groupedSumRows({ 1: 10000 }));
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(res.body.data.recommendation).toBeNull();
  });

  it('returns a null recommendation when no envelope has positive headroom to recommend cutting from', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([
      { id: 1, name: 'Food', monthly_budget_agorot: 50000 },
      { id: 2, name: 'Entertainment', monthly_budget_agorot: 50000 },
    ]);
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(120000))
      .mockResolvedValueOnce(groupedSumRows({ 1: 60000, 2: 60000 }));
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(res.body.data.projectedBalanceAgorot).toBe(-20000);
    expect(res.body.data.atRiskEnvelopes.sort()).toEqual([1, 2]);
    expect(res.body.data.recommendation).toBeNull();
  });

  it('rejects a missing or malformed month', async () => {
    const missing = await request(app).get('/api/forecast').set('Authorization', authHeader());
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ data: null, error: 'validation failed: month' });

    const malformed = await request(app).get('/api/forecast?month=not-a-month').set('Authorization', authHeader());
    expect(malformed.status).toBe(400);
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/forecast?month=2026-08');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthorized' });
    expect(mockEnvelopeFindAll).not.toHaveBeenCalled();
  });

  it('scopes every query to the authenticated caller', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([{ id: 1, name: 'Food', monthly_budget_agorot: 100000 }]);
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(0))
      .mockResolvedValueOnce(groupedSumRows({}));
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));

    await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader(AUTHED_USER_ID));

    expect(mockEnvelopeFindAll.mock.calls[0][0].where.user_id).toBe(AUTHED_USER_ID);
    for (const call of mockTransactionFindAll.mock.calls) {
      expect(call[0].where.user_id).toBe(AUTHED_USER_ID);
    }
    for (const call of mockPlannedExpenseFindAll.mock.calls) {
      expect(call[0].where.user_id).toBe(AUTHED_USER_ID);
    }
  });

  it('never produces float drift — every agorot figure is an integer', async () => {
    mockEnvelopeFindAll.mockResolvedValueOnce([{ id: 1, name: 'Food', monthly_budget_agorot: 33333 }]);
    mockTransactionFindAll
      .mockResolvedValueOnce(overallSumRow(11111))
      .mockResolvedValueOnce(groupedSumRows({ 1: 11111 }));
    mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0)).mockResolvedValueOnce(groupedSumRows({}));

    const res = await request(app).get('/api/forecast?month=2026-08').set('Authorization', authHeader());

    expect(Number.isInteger(res.body.data.projectedBalanceAgorot)).toBe(true);
    for (const id of res.body.data.atRiskEnvelopes) {
      expect(Number.isInteger(id)).toBe(true);
    }
  });

  it('accepts both the YYYY-MM shorthand and a full YYYY-MM-DD month', async () => {
    for (const month of ['2026-08', '2026-08-01']) {
      mockEnvelopeFindAll.mockResolvedValueOnce([]);
      mockTransactionFindAll.mockResolvedValueOnce(overallSumRow(0));
      mockPlannedExpenseFindAll.mockResolvedValueOnce(overallSumRow(0));

      const res = await request(app).get(`/api/forecast?month=${month}`).set('Authorization', authHeader());
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ projectedBalanceAgorot: 0, atRiskEnvelopes: [], recommendation: null });
    }
  });
});
