'use strict';

// Real-Postgres integration tests for the Budget Advisor transport layer
// (docs/features/AGENTS.md § Agent 1). Only the wire is under test —
// advisorService.ask returns a placeholder until A-21 lands the real
// tool-use loop.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// server/services/claudeService.js pulls in the `ai` package, which ships
// ESM and can't be parsed by Jest's CJS transform (see
// tests/transactions.integration.test.js for the same workaround). This
// route only calls logAiCall, so a lightweight mock is enough — no real
// generateObject call happens on this path anyway (advisorService.ask is a
// placeholder pending A-21, see docs/features/AGENTS.md § Agent 1).
const mockLogAiCall = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
  logAiCall: (...args) => mockLogAiCall(...args),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
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

  it('returns the placeholder verdict shape and logs an ai_calls row', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/advisor/ask')
      .set('Authorization', authHeader(user))
      .send({ text: 'Can I afford dining out tonight?' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      verdict: 'in_budget',
      amountAgorot: null,
      projectedBalanceAfterAgorot: null,
      suggestion: null,
      explanationKey: 'advisor.reply.notConnected',
    });

    expect(mockLogAiCall).toHaveBeenCalledWith(user.id, 'budget_advisor', true);
  });
});
