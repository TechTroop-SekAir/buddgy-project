'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

const mockGenerateObject = jest.fn();

// Mock at the `ai` boundary — never a live call from CI (docs/INTEGRATIONS.md § Failure
// Handling). Keeps the test independent of the provider, which is the point of the SDK.
jest.mock('ai', () => ({ generateObject: (...args) => mockGenerateObject(...args) }));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: () => () => 'mock-model' }));

const mockFindAll = jest.fn();
jest.mock('../models', () => ({ Envelope: { findAll: (...args) => mockFindAll(...args) } }));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const AUTHED_USER_ID = 1;
const OTHER_ENVELOPE_ID = 999;

function authHeader(userId = AUTHED_USER_ID) {
  const token = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindAll.mockResolvedValue([{ id: 42, name: 'Cafes & Restaurants' }]);
});

describe('POST /api/transactions/parse', () => {
  it('parses free text into a structured suggestion with integer agorot', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        amount_shekels: 34,
        category: 'Cafes & Restaurants',
        suggested_envelope_id: 42,
        description: 'Coffee and pastry',
        transaction_date: '2026-08-08',
        confidence: 0.93,
      },
    });

    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader())
      .send({ text: 'coffee and a pastry in Ramat Gan, 34 shekels' });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.amount_agorot).toBe(3400);
    expect(Number.isInteger(res.body.data.amount_agorot)).toBe(true);
    expect(res.body.data.suggested_envelope_id).toBe(42);
  });

  it('nulls out an envelope id the caller does not own', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        amount_shekels: 10,
        category: 'Misc',
        suggested_envelope_id: OTHER_ENVELOPE_ID,
        description: 'Something',
        transaction_date: '2026-08-08',
        confidence: 0.5,
      },
    });

    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader())
      .send({ text: 'something, 10 shekels' });

    expect(res.status).toBe(200);
    expect(res.body.data.suggested_envelope_id).toBeNull();
  });

  it('returns 422 when the model call fails (timeout / rate limit)', async () => {
    mockGenerateObject.mockRejectedValue(new Error('upstream timeout'));

    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader())
      .send({ text: 'anything' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unprocessable: ai parse failed');
    expect(res.body.data).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack trace leaked
  });

  it('returns 422 when the model output does not satisfy the schema', async () => {
    mockGenerateObject.mockRejectedValue(
      Object.assign(new Error('response did not match schema'), { name: 'NoObjectGeneratedError' })
    );

    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader())
      .send({ text: 'anything' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unprocessable: ai parse failed');
  });

  it('returns 422, not a hang, when the call times out', async () => {
    mockGenerateObject.mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader())
      .send({ text: 'anything' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unprocessable: ai parse failed');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack trace leaked
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/transactions/parse')
      .send({ text: 'anything' });

    expect(res.status).toBe(401);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('rejects empty text with 400 without calling the model', async () => {
    const res = await request(app)
      .post('/api/transactions/parse')
      .set('Authorization', authHeader())
      .send({ text: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: text');
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });
});
