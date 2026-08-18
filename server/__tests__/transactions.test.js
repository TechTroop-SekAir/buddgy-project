'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// This file's own routes (transactionsController.js) require claudeService.js,
// which requires the ESM-only `ai` package — Jest can't parse it un-mocked.
// Same fix as __tests__/csvImport.test.js: mock the service, not `ai` itself.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const mockTransactionFindAll = jest.fn();
const mockTransactionFindOne = jest.fn();
const mockTransactionCreate = jest.fn();
const mockEnvelopeFindOne = jest.fn();
// requireAuth (server/middleware/auth.js, ticket B-08) now resolves the
// caller from a DB lookup, not just the JWT claim — every test here is a
// single non-admin user, so echoing the signed id back is enough.
const mockUserFindByPk = jest.fn((id) => Promise.resolve({ id, role: 'user', disabled: false }));

// Mock at the models boundary, same shape as __tests__/envelopes.test.js and
// __tests__/csvImport.test.js — DB stays mocked; CI's real Postgres run
// covers the actual schema.
jest.mock('../models', () => ({
  Transaction: {
    findAll: (...args) => mockTransactionFindAll(...args),
    findOne: (...args) => mockTransactionFindOne(...args),
    create: (...args) => mockTransactionCreate(...args),
  },
  Envelope: {
    findOne: (...args) => mockEnvelopeFindOne(...args),
  },
  User: {
    findByPk: (...args) => mockUserFindByPk(...args),
  },
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const AUTHED_USER_ID = 1;
const OWNED_ENVELOPE_ID = 10;
const FOREIGN_ENVELOPE_ID = 20;
const OTHER_USER_TXN_ID = 999;

function authHeader(userId = AUTHED_USER_ID) {
  const token = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

function makeTransactionInstance(data) {
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

describe('GET /api/transactions', () => {
  it('lists the caller\'s transactions for the month', async () => {
    mockTransactionFindAll.mockResolvedValue([
      makeTransactionInstance({ id: 1, user_id: AUTHED_USER_ID, envelope_id: OWNED_ENVELOPE_ID, amount_agorot: 3400, description: 'Coffee', source: 'manual', transaction_date: '2026-08-05' }),
    ]);

    const res = await request(app).get('/api/transactions?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ id: 1, amount_agorot: 3400 })]);
    expect(mockTransactionFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: AUTHED_USER_ID,
          transaction_date: { [require('sequelize').Op.between]: ['2026-08-01', '2026-08-31'] },
        }),
      })
    );
  });

  it('filters by envelopeId when provided', async () => {
    mockTransactionFindAll.mockResolvedValue([]);

    await request(app).get(`/api/transactions?month=2026-08&envelopeId=${OWNED_ENVELOPE_ID}`).set('Authorization', authHeader());

    expect(mockTransactionFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ envelope_id: OWNED_ENVELOPE_ID }) })
    );
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/transactions?month=2026-08');
    expect(res.status).toBe(401);
    expect(mockTransactionFindAll).not.toHaveBeenCalled();
  });
});

describe('POST /api/transactions', () => {
  it('creates a manual transaction with dedup_hash left null', async () => {
    mockEnvelopeFindOne.mockResolvedValue({ id: OWNED_ENVELOPE_ID });
    mockTransactionCreate.mockResolvedValue(
      makeTransactionInstance({ id: 7, user_id: AUTHED_USER_ID, envelope_id: OWNED_ENVELOPE_ID, amount_agorot: 3400, description: 'Coffee', source: 'manual', transaction_date: '2026-08-05' })
    );

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader())
      .send({ envelope_id: OWNED_ENVELOPE_ID, amount_agorot: 3400, description: 'Coffee', transaction_date: '2026-08-05' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ source: 'manual' }));
    expect(mockTransactionCreate).toHaveBeenCalledWith(expect.objectContaining({ user_id: AUTHED_USER_ID, source: 'manual', dedup_hash: null }));
  });

  it('rejects an envelope_id the caller does not own', async () => {
    mockEnvelopeFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader())
      .send({ envelope_id: FOREIGN_ENVELOPE_ID, amount_agorot: 3400, description: 'Coffee', transaction_date: '2026-08-05' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it('rejects a zero/negative amount', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader())
      .send({ amount_agorot: 0, description: 'Coffee', transaction_date: '2026-08-05' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: amount_agorot');
  });

  it('rejects a missing description', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader())
      .send({ amount_agorot: 3400, transaction_date: '2026-08-05' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: description');
  });
});

describe('PATCH /api/transactions/:id', () => {
  it('assigns an unassigned transaction to an owned envelope', async () => {
    mockTransactionFindOne.mockResolvedValue(
      makeTransactionInstance({ id: 3, user_id: AUTHED_USER_ID, envelope_id: null, amount_agorot: 12990, description: 'Shufersal', source: 'csv', transaction_date: '2026-08-01' })
    );
    mockEnvelopeFindOne.mockResolvedValue({ id: OWNED_ENVELOPE_ID });

    const res = await request(app)
      .patch('/api/transactions/3')
      .set('Authorization', authHeader())
      .send({ envelope_id: OWNED_ENVELOPE_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.envelope_id).toBe(OWNED_ENVELOPE_ID);
  });

  it('rejects assigning to an envelope the caller does not own', async () => {
    mockTransactionFindOne.mockResolvedValue(
      makeTransactionInstance({ id: 3, user_id: AUTHED_USER_ID, envelope_id: null, amount_agorot: 12990, description: 'Shufersal', source: 'csv', transaction_date: '2026-08-01' })
    );
    mockEnvelopeFindOne.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/transactions/3')
      .set('Authorization', authHeader())
      .send({ envelope_id: FOREIGN_ENVELOPE_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });

  it('returns 404, not 403, for another user\'s transaction', async () => {
    mockTransactionFindOne.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/transactions/${OTHER_USER_TXN_ID}`)
      .set('Authorization', authHeader())
      .send({ description: 'Hijacked' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('deletes a transaction the caller owns', async () => {
    const instance = makeTransactionInstance({ id: 3, user_id: AUTHED_USER_ID, envelope_id: null, amount_agorot: 12990, description: 'Shufersal', source: 'csv', transaction_date: '2026-08-01' });
    mockTransactionFindOne.mockResolvedValue(instance);

    const res = await request(app).delete('/api/transactions/3').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 3 });
    expect(instance.destroy).toHaveBeenCalled();
  });

  it('returns 404 for another user\'s transaction and never calls destroy', async () => {
    mockTransactionFindOne.mockResolvedValue(null);

    const res = await request(app).delete(`/api/transactions/${OTHER_USER_TXN_ID}`).set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/transactions/3');
    expect(res.status).toBe(401);
    expect(mockTransactionFindOne).not.toHaveBeenCalled();
  });
});
