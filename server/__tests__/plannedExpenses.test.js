'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// app.js pulls in routes/transactions.js -> controllers/transactionsController.js
// -> services/claudeService.js, which requires the ESM-only `ai` package —
// Jest can't parse it un-mocked. Same fix as __tests__/transactions.test.js.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const mockPlannedExpenseFindAll = jest.fn();
const mockPlannedExpenseFindOne = jest.fn();
const mockPlannedExpenseCreate = jest.fn();
const mockEnvelopeFindOne = jest.fn();
// requireAuth (server/middleware/auth.js, ticket B-08) now resolves the
// caller from a DB lookup, not just the JWT claim — every test here is a
// single non-admin user, so echoing the signed id back is enough.
const mockUserFindByPk = jest.fn((id) => Promise.resolve({ id, role: 'user', disabled: false }));

// Mock at the models boundary, same shape as __tests__/envelopes.test.js and
// __tests__/transactions.test.js — DB stays mocked; CI's real Postgres run
// covers the actual schema.
jest.mock('../models', () => ({
  PlannedExpense: {
    findAll: (...args) => mockPlannedExpenseFindAll(...args),
    findOne: (...args) => mockPlannedExpenseFindOne(...args),
    create: (...args) => mockPlannedExpenseCreate(...args),
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
const OTHER_USER_PLANNED_EXPENSE_ID = 999;

function authHeader(userId = AUTHED_USER_ID) {
  const token = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

function makePlannedExpenseInstance(data) {
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
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/planned-expenses', () => {
  it('lists the caller\'s planned expenses for the month', async () => {
    mockPlannedExpenseFindAll.mockResolvedValue([
      makePlannedExpenseInstance({
        id: 1,
        user_id: AUTHED_USER_ID,
        envelope_id: null,
        title: 'Dentist',
        amount_agorot: 25000,
        due_date: '2026-08-12',
        google_event_id: 'evt_1',
        is_confirmed: false,
      }),
    ]);

    const res = await request(app).get('/api/planned-expenses?month=2026-08').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ id: 1, title: 'Dentist' })]);
    expect(mockPlannedExpenseFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: AUTHED_USER_ID,
          due_date: { [require('sequelize').Op.between]: ['2026-08-01', '2026-08-31'] },
        }),
      })
    );
  });

  it('rejects an unparseable month', async () => {
    const res = await request(app).get('/api/planned-expenses?month=not-a-month').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: month');
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/planned-expenses?month=2026-08');
    expect(res.status).toBe(401);
    expect(mockPlannedExpenseFindAll).not.toHaveBeenCalled();
  });
});

describe('POST /api/planned-expenses', () => {
  it('creates a manual planned expense owned by the caller', async () => {
    mockEnvelopeFindOne.mockResolvedValue({ id: OWNED_ENVELOPE_ID });
    mockPlannedExpenseCreate.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 7,
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        title: 'Water bill',
        amount_agorot: 8000,
        due_date: '2026-08-25',
        google_event_id: null,
        is_confirmed: false,
        source: 'manual',
      })
    );

    const res = await request(app)
      .post('/api/planned-expenses')
      .set('Authorization', authHeader())
      .send({ envelope_id: OWNED_ENVELOPE_ID, title: 'Water bill', amount_agorot: 8000, due_date: '2026-08-25' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ id: 7, source: 'manual', google_event_id: null }));
    expect(mockPlannedExpenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        google_event_id: null,
        is_confirmed: false,
        source: 'manual',
      })
    );
  });

  it('rejects a foreign envelope_id without creating anything', async () => {
    mockEnvelopeFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/planned-expenses')
      .set('Authorization', authHeader())
      .send({ envelope_id: FOREIGN_ENVELOPE_ID, title: 'Water bill', amount_agorot: 8000, due_date: '2026-08-25' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
    expect(mockPlannedExpenseCreate).not.toHaveBeenCalled();
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/planned-expenses')
      .set('Authorization', authHeader())
      .send({ title: 'Water bill' });

    expect(res.status).toBe(400);
    expect(mockPlannedExpenseCreate).not.toHaveBeenCalled();
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/planned-expenses')
      .send({ title: 'Water bill', amount_agorot: 8000, due_date: '2026-08-25' });

    expect(res.status).toBe(401);
    expect(mockPlannedExpenseCreate).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/planned-expenses/:id', () => {
  it('confirms a planned expense and assigns it to an owned envelope', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: null,
        title: 'Car service',
        amount_agorot: 45000,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: false,
      })
    );
    mockEnvelopeFindOne.mockResolvedValue({ id: OWNED_ENVELOPE_ID });

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ envelope_id: OWNED_ENVELOPE_ID, is_confirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.envelope_id).toBe(OWNED_ENVELOPE_ID);
    expect(res.body.data.is_confirmed).toBe(true);
  });

  it('rejects assigning to an envelope the caller does not own', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: null,
        title: 'Car service',
        amount_agorot: 45000,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: false,
      })
    );
    mockEnvelopeFindOne.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ envelope_id: FOREIGN_ENVELOPE_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: envelope_id');
  });

  it('rejects an empty body', async () => {
    const res = await request(app).patch('/api/planned-expenses/3').set('Authorization', authHeader()).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: body');
    expect(mockPlannedExpenseFindOne).not.toHaveBeenCalled();
  });

  it('returns 404, not 403, for another user\'s planned expense', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/planned-expenses/${OTHER_USER_PLANNED_EXPENSE_ID}`)
      .set('Authorization', authHeader())
      .send({ is_confirmed: true });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).patch('/api/planned-expenses/3').send({ is_confirmed: true });
    expect(res.status).toBe(401);
    expect(mockPlannedExpenseFindOne).not.toHaveBeenCalled();
  });
});
