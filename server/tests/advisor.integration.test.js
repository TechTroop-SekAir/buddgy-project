'use strict';

// Real-Postgres integration tests for the Budget Advisor agent
// (docs/features/AGENTS.md § Agent 1). advisorService.ask() now runs a real
// read-only tool-use loop — this suite proves the route/controller/
// validation wiring and advisorService's own logic (money math, id
// revalidation, explanationKey mapping, failure contract) against real
// envelope/forecast rows. The model call itself is mocked at the
// claudeService.runToolLoop boundary (see below for why), not re-tested
// here — server/__tests__/claudeService.toolLoop.test.js and
// server/__tests__/advisorService.test.js cover that in isolation.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// server/services/claudeService.js pulls in the `ai` package, which ships
// ESM and can't be parsed by Jest's CJS transform (see
// tests/transactions.integration.test.js for the same workaround). Mocking
// runToolLoop lets this suite drive real advisorService.ask() logic (real
// envelopes/forecast from Postgres, real money math, real id revalidation)
// while stubbing out only the actual Anthropic round trip.
const mockRunToolLoop = jest.fn();
const mockLogAiCall = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
  logAiCall: (...args) => mockLogAiCall(...args),
  runToolLoop: (...args) => mockRunToolLoop(...args),
  stepCountIs: (n) => ({ type: 'stepCount', n }),
  hasToolCall: (name) => ({ type: 'hasToolCall', name }),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createEnvelope, authHeader } = require('./helpers/fixtures');

// advisorService.ask() has no client-supplied month (the route only ever
// gives it { text }) — it always resolves "current month" from the real
// clock, so fixtures must seed against whatever month the suite actually
// runs in rather than a hardcoded string.
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Builds a fake generateText result exposing one provide_verdict tool call, matching the shape advisorService.ask() reads (result.toolCalls). */
function verdictResult(input) {
  return { toolCalls: [{ toolName: 'provide_verdict', input }] };
}

beforeEach(async () => {
  await resetDb();
  mockRunToolLoop.mockReset();
  mockLogAiCall.mockClear();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /api/advisor/ask', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).post('/api/advisor/ask').send({ text: 'Can I afford tires?' });
    expect(res.status).toBe(401);
  });

  it('rejects empty text', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/advisor/ask').set('Authorization', authHeader(user)).send({ text: '' });
    expect(res.status).toBe(400);
  });

  it('rejects text over 500 characters', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('answers a status question (no concrete amount) as in_budget and logs a successful ai_calls row', async () => {
    const user = await createUser();
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'in_budget', amount_shekels: null, suggested_envelope_id: null, cut_shekels: null })
    );

    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'How much is left in Groceries?' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      verdict: 'in_budget',
      amountAgorot: null,
      projectedBalanceAfterAgorot: 0, // zero envelopes/activity this month -> forecast is 0
      suggestion: null,
      explanationKey: 'advisor.reply.inBudgetStatus',
    });
    expect(mockLogAiCall).toHaveBeenCalledWith(user.id, 'budget_advisor', true);
  });

  it('answers over_budget with a suggestion, converting the model-picked envelope id/cut to agorot', async () => {
    const user = await createUser();
    const fun = await createEnvelope({ user_id: user.id, name: 'Entertainment', monthly_budget_agorot: 50000, month: currentMonth() });
    mockRunToolLoop.mockResolvedValue(
      verdictResult({
        verdict: 'over_budget',
        amount_shekels: 400,
        suggested_envelope_id: fun.id,
        cut_shekels: 120,
      })
    );

    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'I need to spend 400 NIS on new tires, unbudgeted — how do I balance my budget?' });

    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toBe('over_budget');
    expect(res.body.data.amountAgorot).toBe(40000);
    expect(res.body.data.projectedBalanceAfterAgorot).toBe(10000); // envelope budget 50000, no other activity - 40000
    expect(res.body.data.suggestion).toEqual({ envelopeId: fun.id, envelopeName: 'Entertainment', cutAgorot: 12000 });
    expect(res.body.data.explanationKey).toBe('advisor.reply.overBudgetWithSuggestion');
  });

  it('rejects a hallucinated envelope id — suggestion is null even though the model "suggested" one', async () => {
    const user = await createUser();
    mockRunToolLoop.mockResolvedValue(
      verdictResult({
        verdict: 'over_budget',
        amount_shekels: 400,
        suggested_envelope_id: 999999, // does not exist for this user
        cut_shekels: 120,
      })
    );

    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'Unbudgeted 400 NIS expense, how do I cover it?' });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestion).toBeNull();
    expect(res.body.data.explanationKey).toBe('advisor.reply.overBudgetNoSuggestion');
  });

  it('returns 422 and logs a failed ai_calls row when the loop never produces a provide_verdict call', async () => {
    const user = await createUser();
    mockRunToolLoop.mockResolvedValue({ toolCalls: [] }); // step cap hit, no final answer

    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'Can I afford dining out tonight?' });

    expect(res.status).toBe(422);
    expect(mockLogAiCall).toHaveBeenCalledWith(user.id, 'budget_advisor', false);
  });

  it('returns 422 and logs a failed ai_calls row when the underlying SDK call throws (timeout/rate limit)', async () => {
    const user = await createUser();
    mockRunToolLoop.mockRejectedValue(new Error('timeout'));

    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'Can I afford dining out tonight?' });

    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(mockLogAiCall).toHaveBeenCalledWith(user.id, 'budget_advisor', false);
  });

  it('only ever returns a known explanationKey', async () => {
    const user = await createUser();
    const knownKeys = [
      'advisor.reply.inBudget',
      'advisor.reply.inBudgetStatus',
      'advisor.reply.nearLimit',
      'advisor.reply.overBudgetWithSuggestion',
      'advisor.reply.overBudgetNoSuggestion',
    ];

    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'near_limit', amount_shekels: 50, suggested_envelope_id: null, cut_shekels: null })
    );
    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'Can I spend 50 NIS more?' });

    expect(knownKeys).toContain(res.body.data.explanationKey);
  });
});
