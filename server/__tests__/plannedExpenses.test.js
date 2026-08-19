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
const mockTransactionCreate = jest.fn();
const mockTransactionDestroy = jest.fn();
const mockTransactionUpdate = jest.fn();
// requireAuth (server/middleware/auth.js, ticket B-08) now resolves the
// caller from a DB lookup, not just the JWT claim — every test here is a
// single non-admin user, so echoing the signed id back is enough.
const mockUserFindByPk = jest.fn((id) => Promise.resolve({ id, role: 'user', disabled: false }));

// Fake DB-transaction token handed to plannedExpenseService.js's
// sequelize.transaction(async (t) => ...) callback — only needs to satisfy
// `t.LOCK.UPDATE` (findOwned's row lock) and being passed through as the
// `transaction` option on every mocked call below.
const FAKE_DB_TRANSACTION = { LOCK: { UPDATE: 'UPDATE' } };

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
  Transaction: {
    create: (...args) => mockTransactionCreate(...args),
    destroy: (...args) => mockTransactionDestroy(...args),
    update: (...args) => mockTransactionUpdate(...args),
  },
  User: {
    findByPk: (...args) => mockUserFindByPk(...args),
  },
  sequelize: {
    transaction: (cb) => cb(FAKE_DB_TRANSACTION),
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
    // Mirrors real Sequelize instance behavior: every column is a direct
    // property, not just accessible via .get(). plannedExpenseService.js's
    // update() reads these directly (is_confirmed transition, amount/
    // envelope/title/due_date fallbacks, transaction_id) before deciding
    // whether to spawn/delete a transaction.
    get id() {
      return state.id;
    },
    get user_id() {
      return state.user_id;
    },
    get envelope_id() {
      return state.envelope_id;
    },
    get title() {
      return state.title;
    },
    get amount_agorot() {
      return state.amount_agorot;
    },
    get due_date() {
      return state.due_date;
    },
    get google_event_id() {
      return state.google_event_id;
    },
    get is_confirmed() {
      return state.is_confirmed;
    },
    get source() {
      return state.source;
    },
    get transaction_id() {
      return state.transaction_id;
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
  it('confirms a planned expense, assigns it to an owned envelope, and creates a linked transaction', async () => {
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
        transaction_id: null,
      })
    );
    mockEnvelopeFindOne.mockResolvedValue({ id: OWNED_ENVELOPE_ID });
    mockTransactionCreate.mockResolvedValue({ id: 501 });

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ envelope_id: OWNED_ENVELOPE_ID, is_confirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.envelope_id).toBe(OWNED_ENVELOPE_ID);
    expect(res.body.data.is_confirmed).toBe(true);
    expect(res.body.data.transaction_id).toBe(501);
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        amount_agorot: 45000,
        description: 'Car service',
        source: 'planned_expense',
        transaction_date: '2026-08-20',
        dedup_hash: null,
      }),
      { transaction: FAKE_DB_TRANSACTION }
    );
  });

  it('rejects confirming a planned expense with no amount, without creating a transaction', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: null,
        title: 'Car service',
        amount_agorot: null,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: false,
        transaction_id: null,
      })
    );

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ is_confirmed: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: amount_agorot');
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it('does not create a second transaction when re-confirming an already-confirmed planned expense', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        title: 'Car service',
        amount_agorot: 45000,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: true,
        transaction_id: 501,
      })
    );

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ is_confirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe(501);
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it('unconfirming deletes the linked transaction and clears the link', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        title: 'Car service',
        amount_agorot: 45000,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: true,
        transaction_id: 501,
      })
    );

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ is_confirmed: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_confirmed).toBe(false);
    expect(res.body.data.transaction_id).toBe(null);
    expect(mockTransactionDestroy).toHaveBeenCalledWith({
      where: { id: 501, user_id: AUTHED_USER_ID },
      transaction: FAKE_DB_TRANSACTION,
    });
  });

  it('reassigning an already-confirmed planned expense writes the new envelope back to its linked transaction', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        title: 'Car service',
        amount_agorot: 45000,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: true,
        transaction_id: 501,
      })
    );
    const otherOwnedEnvelopeId = 11;
    mockEnvelopeFindOne.mockResolvedValue({ id: otherOwnedEnvelopeId });

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ envelope_id: otherOwnedEnvelopeId });

    expect(res.status).toBe(200);
    expect(res.body.data.envelope_id).toBe(otherOwnedEnvelopeId);
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(mockTransactionDestroy).not.toHaveBeenCalled();
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      { envelope_id: otherOwnedEnvelopeId },
      { where: { id: 501, user_id: AUTHED_USER_ID }, transaction: FAKE_DB_TRANSACTION }
    );
  });

  it('editing an unconfirmed planned expense never touches a transaction', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(
      makePlannedExpenseInstance({
        id: 3,
        user_id: AUTHED_USER_ID,
        envelope_id: OWNED_ENVELOPE_ID,
        title: 'Car service',
        amount_agorot: 45000,
        due_date: '2026-08-20',
        google_event_id: 'evt_3',
        is_confirmed: false,
        transaction_id: null,
      })
    );

    const res = await request(app)
      .patch('/api/planned-expenses/3')
      .set('Authorization', authHeader())
      .send({ title: 'Car service (renamed)' });

    expect(res.status).toBe(200);
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(mockTransactionDestroy).not.toHaveBeenCalled();
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

describe('DELETE /api/planned-expenses/:id', () => {
  it('deletes a planned expense the caller owns', async () => {
    const instance = makePlannedExpenseInstance({
      id: 3,
      user_id: AUTHED_USER_ID,
      envelope_id: null,
      title: 'Car service',
      amount_agorot: 45000,
      due_date: '2026-08-20',
      google_event_id: 'evt_3',
      is_confirmed: false,
    });
    mockPlannedExpenseFindOne.mockResolvedValue(instance);

    const res = await request(app).delete('/api/planned-expenses/3').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 3 });
    expect(instance.destroy).toHaveBeenCalled();
    expect(mockTransactionDestroy).not.toHaveBeenCalled();
  });

  it('deleting a confirmed planned expense also deletes its linked transaction', async () => {
    const instance = makePlannedExpenseInstance({
      id: 3,
      user_id: AUTHED_USER_ID,
      envelope_id: OWNED_ENVELOPE_ID,
      title: 'Car service',
      amount_agorot: 45000,
      due_date: '2026-08-20',
      google_event_id: 'evt_3',
      is_confirmed: true,
      transaction_id: 501,
    });
    mockPlannedExpenseFindOne.mockResolvedValue(instance);

    const res = await request(app).delete('/api/planned-expenses/3').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 3 });
    expect(mockTransactionDestroy).toHaveBeenCalledWith({
      where: { id: 501, user_id: AUTHED_USER_ID },
      transaction: FAKE_DB_TRANSACTION,
    });
    expect(instance.destroy).toHaveBeenCalled();
  });

  it('returns 404, not 403, for another user\'s planned expense and never calls destroy', async () => {
    mockPlannedExpenseFindOne.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/planned-expenses/${OTHER_USER_PLANNED_EXPENSE_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/planned-expenses/3');
    expect(res.status).toBe(401);
    expect(mockPlannedExpenseFindOne).not.toHaveBeenCalled();
  });
});
