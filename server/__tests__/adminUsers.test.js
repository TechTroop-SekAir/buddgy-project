'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// app.js pulls in routes/transactions.js -> controllers/transactionsController.js
// -> services/claudeService.js, which requires the ESM-only `ai` package —
// Jest can't parse it un-mocked. Same fix as __tests__/adminCategories.test.js.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

// authService.login() compares against a real bcrypt hash — mocked at the
// bcrypt boundary so this suite doesn't need to generate one.
const mockBcryptCompare = jest.fn();
jest.mock('bcrypt', () => ({
  compare: (...args) => mockBcryptCompare(...args),
  hash: jest.fn(async () => 'hashed'),
}));

const mockUserFindAll = jest.fn();
const mockUserFindOne = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserCount = jest.fn();
const mockTransactionCount = jest.fn();
const mockAiCallCount = jest.fn();

// Mock at the models boundary, same shape as __tests__/adminCategories.test.js —
// the DB stays fully mocked here; CI's real Postgres run exercises the
// actual schema.
jest.mock('../models', () => ({
  User: {
    findAll: (...args) => mockUserFindAll(...args),
    findOne: (...args) => mockUserFindOne(...args),
    findByPk: (...args) => mockUserFindByPk(...args),
    count: (...args) => mockUserCount(...args),
  },
  Transaction: { count: (...args) => mockTransactionCount(...args) },
  AiCall: { count: (...args) => mockAiCallCount(...args) },
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const ADMIN_USER_ID = 1;
const NON_ADMIN_USER_ID = 2;
const UNKNOWN_USER_ID = 999;

function authHeader(role = 'admin', userId = ADMIN_USER_ID) {
  const token = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

function adminAuthHeader() {
  return authHeader('admin', ADMIN_USER_ID);
}

function userAuthHeader() {
  return authHeader('user', NON_ADMIN_USER_ID);
}

/** Builds a fake Sequelize instance with the instance methods the service calls. */
function makeUserInstance(data) {
  const state = { ...data };
  return {
    get id() {
      return state.id;
    },
    get disabled() {
      return state.disabled;
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
  // Every authenticated request in this suite hits requireAuth's DB lookup
  // first — default both seeded ids to enabled so tests only override what
  // they're actually exercising (server/middleware/auth.js, ticket B-08).
  mockUserFindByPk.mockImplementation((id) =>
    Promise.resolve({ id, role: id === ADMIN_USER_ID ? 'admin' : 'user', disabled: false })
  );
});

describe('GET /api/admin/users', () => {
  it('lists users without ever exposing password_hash or google_refresh_token', async () => {
    mockUserFindAll.mockResolvedValueOnce([
      makeUserInstance({
        id: 1,
        email: 'admin@buddgy.com',
        full_name: 'Admin User',
        avatar_url: null,
        role: 'admin',
        disabled: false,
        created_at: '2026-08-09T00:00:00.000Z',
      }),
      makeUserInstance({
        id: 2,
        email: 'test@buddgy.com',
        full_name: 'Dev User',
        avatar_url: null,
        role: 'user',
        disabled: false,
        created_at: '2026-08-09T00:00:00.000Z',
      }),
    ]);

    const res = await request(app).get('/api/admin/users').set('Authorization', adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password_hash/);
    expect(raw).not.toMatch(/google_refresh_token/);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
    expect(mockUserFindAll).not.toHaveBeenCalled();
  });

  it('rejects with 403 for a non-admin token', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', userAuthHeader());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    expect(mockUserFindAll).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/admin/users/:id', () => {
  it('disables a user', async () => {
    mockUserFindOne.mockResolvedValueOnce(
      makeUserInstance({ id: NON_ADMIN_USER_ID, email: 'test@buddgy.com', role: 'user', disabled: false })
    );

    const res = await request(app)
      .patch(`/api/admin/users/${NON_ADMIN_USER_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({ disabled: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { id: NON_ADMIN_USER_ID, disabled: true }, error: null });
  });

  it('re-enables a disabled user', async () => {
    mockUserFindOne.mockResolvedValueOnce(
      makeUserInstance({ id: NON_ADMIN_USER_ID, email: 'test@buddgy.com', role: 'user', disabled: true })
    );

    const res = await request(app)
      .patch(`/api/admin/users/${NON_ADMIN_USER_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({ disabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: NON_ADMIN_USER_ID, disabled: false });
  });

  it('rejects an admin disabling their own account, without updating anything', async () => {
    mockUserFindOne.mockResolvedValueOnce(
      makeUserInstance({ id: ADMIN_USER_ID, email: 'admin@buddgy.com', role: 'admin', disabled: false })
    );

    const res = await request(app)
      .patch(`/api/admin/users/${ADMIN_USER_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({ disabled: true });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ data: null, error: 'cannot disable your own account' });
  });

  it('returns 404 for an unknown id', async () => {
    mockUserFindOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch(`/api/admin/users/${UNKNOWN_USER_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({ disabled: true });

    expect(res.status).toBe(404);
  });

  it('rejects a missing or invalid disabled value without querying the DB', async () => {
    const empty = await request(app)
      .patch(`/api/admin/users/${NON_ADMIN_USER_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({});
    expect(empty.status).toBe(400);

    const wrongType = await request(app)
      .patch(`/api/admin/users/${NON_ADMIN_USER_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({ disabled: 'yes' });
    expect(wrongType.status).toBe(400);

    expect(mockUserFindOne).not.toHaveBeenCalled();
  });

  it('rejects with 403 for a non-admin token', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${NON_ADMIN_USER_ID}`)
      .set('Authorization', userAuthHeader())
      .send({ disabled: true });
    expect(res.status).toBe(403);
    expect(mockUserFindOne).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/stats', () => {
  it('returns userCount, transactionCount, and aiCallCount', async () => {
    mockUserCount.mockResolvedValueOnce(12);
    mockTransactionCount.mockResolvedValueOnce(340);
    mockAiCallCount.mockResolvedValueOnce(58);

    const res = await request(app).get('/api/admin/stats').set('Authorization', adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { userCount: 12, transactionCount: 340, aiCallCount: 58 }, error: null });
  });

  it('rejects with 403 for a non-admin token', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', userAuthHeader());
    expect(res.status).toBe(403);
    expect(mockUserCount).not.toHaveBeenCalled();
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });
});

describe('requireAuth — disabled-user enforcement (ticket B-08)', () => {
  it('rejects a request whose token belongs to a now-disabled user', async () => {
    mockUserFindByPk.mockResolvedValueOnce({ id: NON_ADMIN_USER_ID, role: 'user', disabled: true });

    // Any authenticated route exercises the same requireAuth check —
    // /api/admin/users is convenient since this suite already mocks it,
    // even though the caller (a disabled non-admin) would also fail requireAdmin.
    const res = await request(app).get('/api/admin/users').set('Authorization', userAuthHeader());

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthorized' });
  });
});

describe('POST /api/auth/login — disabled-user enforcement (ticket B-08)', () => {
  it('rejects a disabled user with the generic unauthorized message', async () => {
    mockUserFindOne.mockResolvedValueOnce({
      id: NON_ADMIN_USER_ID,
      email: 'test@buddgy.com',
      password_hash: 'hashed',
      full_name: 'Dev User',
      avatar_url: null,
      role: 'user',
      google_refresh_token: null,
      disabled: true,
    });
    mockBcryptCompare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@buddgy.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthorized' });
  });

  it('logs in an enabled user normally', async () => {
    mockUserFindOne.mockResolvedValueOnce({
      id: NON_ADMIN_USER_ID,
      email: 'test@buddgy.com',
      password_hash: 'hashed',
      full_name: 'Dev User',
      avatar_url: null,
      role: 'user',
      google_refresh_token: null,
      disabled: false,
    });
    mockBcryptCompare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@buddgy.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: NON_ADMIN_USER_ID, email: 'test@buddgy.com' });
  });
});
