'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// app.js pulls in routes/transactions.js -> controllers/transactionsController.js
// -> services/claudeService.js, which requires the ESM-only `ai` package —
// Jest can't parse it un-mocked. Same fix as __tests__/csvImport.test.js:
// mock the service directly rather than the `ai` package itself.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const mockEnvelopeFindAll = jest.fn();
const mockEnvelopeFindOne = jest.fn();
const mockEnvelopeCreate = jest.fn();
const mockTransactionFindAll = jest.fn();
// requireAuth (server/middleware/auth.js, ticket B-08) now resolves the
// caller from a DB lookup, not just the JWT claim — every test here is a
// single non-admin user, so echoing the signed id back is enough.
const mockUserFindByPk = jest.fn((id) => Promise.resolve({ id, role: 'user', disabled: false }));

// Mock at the models boundary, same shape as __tests__/csvImport.test.js and
// __tests__/quickEntry.test.js — the DB stays fully mocked here; CI's real
// Postgres run is what exercises the actual schema/aggregation.
jest.mock('../models', () => ({
  Envelope: {
    findAll: (...args) => mockEnvelopeFindAll(...args),
    findOne: (...args) => mockEnvelopeFindOne(...args),
    create: (...args) => mockEnvelopeCreate(...args),
  },
  Transaction: {
    findAll: (...args) => mockTransactionFindAll(...args),
  },
  User: {
    findByPk: (...args) => mockUserFindByPk(...args),
  },
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const AUTHED_USER_ID = 1;
const OTHER_USER_ENVELOPE_ID = 999;

function authHeader(userId = AUTHED_USER_ID) {
  const token = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

/** Builds a fake Sequelize instance with the instance methods the service calls. */
function makeEnvelopeInstance(data) {
  const state = { ...data };
  return {
    get id() {
      return state.id;
    },
    get: ({ plain } = {}) => (plain ? { ...state } : state),
    update: jest.fn(async (patch) => {
      Object.assign(state, patch);
      return state;
    }),
    destroy: jest.fn(async () => {}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/envelopes', () => {
  it('lists the caller\'s envelopes with spent_agorot summed from transactions', async () => {
    mockEnvelopeFindAll.mockResolvedValue([
      makeEnvelopeInstance({ id: 1, user_id: AUTHED_USER_ID, name: 'Groceries', monthly_budget_agorot: 200000, color: null, month: '2026-08-01' }),
      makeEnvelopeInstance({ id: 2, user_id: AUTHED_USER_ID, name: 'Rent', monthly_budget_agorot: 500000, color: null, month: '2026-08-01' }),
    ]);
    mockTransactionFindAll.mockResolvedValue([{ envelope_id: 1, spent_agorot: '4500' }]);

    const res = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: 1, spent_agorot: 4500 }),
      expect.objectContaining({ id: 2, spent_agorot: 0 }),
    ]);
    // spent_agorot must be a real integer, not the raw SUM string Postgres returns.
    expect(Number.isInteger(res.body.data[0].spent_agorot)).toBe(true);
  });

  it('accepts both 2026-08 and 2026-08-01 for month', async () => {
    mockEnvelopeFindAll.mockResolvedValue([]);

    const shortForm = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader());
    const longForm = await request(app).get('/api/envelopes?month=2026-08-01').set('Authorization', authHeader());

    expect(shortForm.status).toBe(200);
    expect(longForm.status).toBe(200);
    expect(mockEnvelopeFindAll).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ month: '2026-08-01' }) }));
    expect(mockEnvelopeFindAll).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ month: '2026-08-01' }) }));
  });

  it('scopes the spent_agorot sum to the queried month, excluding transactions dated outside it', async () => {
    mockEnvelopeFindAll.mockResolvedValue([
      makeEnvelopeInstance({ id: 1, user_id: AUTHED_USER_ID, name: 'Groceries', monthly_budget_agorot: 200000, color: null, month: '2026-08-01' }),
    ]);
    mockTransactionFindAll.mockResolvedValue([]);

    await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader());

    expect(mockTransactionFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transaction_date: { [require('sequelize').Op.between]: ['2026-08-01', '2026-08-31'] },
        }),
      })
    );
  });

  it('returns [] without querying transactions when the caller has no envelopes', async () => {
    mockEnvelopeFindAll.mockResolvedValue([]);

    const res = await request(app).get('/api/envelopes?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(mockTransactionFindAll).not.toHaveBeenCalled();
  });

  it('rejects an unparseable month', async () => {
    const res = await request(app).get('/api/envelopes?month=not-a-month').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: month');
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/envelopes?month=2026-08');
    expect(res.status).toBe(401);
    expect(mockEnvelopeFindAll).not.toHaveBeenCalled();
  });
});

describe('POST /api/envelopes', () => {
  it('creates an envelope owned by the caller, spent_agorot starts at 0', async () => {
    mockEnvelopeCreate.mockResolvedValue(
      makeEnvelopeInstance({ id: 5, user_id: AUTHED_USER_ID, name: 'Fun', monthly_budget_agorot: 30000, color: '#3366ff', month: '2026-08-01' })
    );

    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader())
      .send({ name: 'Fun', monthly_budget_agorot: 30000, color: '#3366ff', month: '2026-08' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ id: 5, spent_agorot: 0 }));
    expect(mockEnvelopeCreate).toHaveBeenCalledWith(expect.objectContaining({ user_id: AUTHED_USER_ID, month: '2026-08-01' }));
  });

  it('rejects a missing name without creating anything', async () => {
    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader())
      .send({ monthly_budget_agorot: 1000, month: '2026-08' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: name');
    expect(mockEnvelopeCreate).not.toHaveBeenCalled();
  });

  it('rejects a zero/negative budget', async () => {
    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader())
      .send({ name: 'Fun', monthly_budget_agorot: 0, month: '2026-08' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: monthly_budget_agorot');
  });

  it('rejects a name that duplicates an existing envelope in the same month, without creating anything', async () => {
    mockEnvelopeFindOne.mockResolvedValue(
      makeEnvelopeInstance({ id: 5, user_id: AUTHED_USER_ID, name: 'Fun', monthly_budget_agorot: 30000, color: null, month: '2026-08-01' })
    );

    const res = await request(app)
      .post('/api/envelopes')
      .set('Authorization', authHeader())
      .send({ name: 'Fun', monthly_budget_agorot: 5000, month: '2026-08' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate: name');
    expect(mockEnvelopeCreate).not.toHaveBeenCalled();
  });
});

describe('PUT/PATCH /api/envelopes/:id', () => {
  it('updates an envelope the caller owns via PUT', async () => {
    mockEnvelopeFindOne.mockResolvedValue(
      makeEnvelopeInstance({ id: 5, user_id: AUTHED_USER_ID, name: 'Fun', monthly_budget_agorot: 30000, color: null, month: '2026-08-01' })
    );

    const res = await request(app)
      .put('/api/envelopes/5')
      .set('Authorization', authHeader())
      .send({ monthly_budget_agorot: 40000 });

    expect(res.status).toBe(200);
    expect(res.body.data.monthly_budget_agorot).toBe(40000);
    expect(mockEnvelopeFindOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5, user_id: AUTHED_USER_ID } }));
  });

  it('updates an envelope the caller owns via PATCH (matches the shipped client)', async () => {
    // First call: findOwned's ownership lookup. Second: assertNameAvailable's
    // duplicate check, run because the patch changes `name` — null means no
    // other envelope in this user's month already has it.
    mockEnvelopeFindOne
      .mockResolvedValueOnce(
        makeEnvelopeInstance({ id: 5, user_id: AUTHED_USER_ID, name: 'Fun', monthly_budget_agorot: 30000, color: null, month: '2026-08-01' })
      )
      .mockResolvedValueOnce(null);

    const res = await request(app)
      .patch('/api/envelopes/5')
      .set('Authorization', authHeader())
      .send({ name: 'Entertainment' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Entertainment');
  });

  it('rejects renaming to a name already used by another envelope in the same month', async () => {
    mockEnvelopeFindOne
      .mockResolvedValueOnce(
        makeEnvelopeInstance({ id: 5, user_id: AUTHED_USER_ID, name: 'Fun', monthly_budget_agorot: 30000, color: null, month: '2026-08-01' })
      )
      .mockResolvedValueOnce(makeEnvelopeInstance({ id: 6, user_id: AUTHED_USER_ID, name: 'Entertainment' }));

    const res = await request(app)
      .patch('/api/envelopes/5')
      .set('Authorization', authHeader())
      .send({ name: 'Entertainment' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate: name');
  });

  it('returns 404, not 403, for another user\'s envelope', async () => {
    mockEnvelopeFindOne.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/envelopes/${OTHER_USER_ENVELOPE_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});

describe('DELETE /api/envelopes/:id', () => {
  it('deletes an envelope the caller owns', async () => {
    const instance = makeEnvelopeInstance({ id: 5, user_id: AUTHED_USER_ID, name: 'Fun', monthly_budget_agorot: 30000, color: null, month: '2026-08-01' });
    mockEnvelopeFindOne.mockResolvedValue(instance);

    const res = await request(app).delete('/api/envelopes/5').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5 });
    expect(instance.destroy).toHaveBeenCalled();
  });

  it('returns 404 for another user\'s envelope and never calls destroy', async () => {
    mockEnvelopeFindOne.mockResolvedValue(null);

    const res = await request(app).delete(`/api/envelopes/${OTHER_USER_ENVELOPE_ID}`).set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/envelopes/5');
    expect(res.status).toBe(401);
    expect(mockEnvelopeFindOne).not.toHaveBeenCalled();
  });
});
