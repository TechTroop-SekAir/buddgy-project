'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// app.js pulls in routes/transactions.js -> controllers/transactionsController.js
// -> services/claudeService.js, which requires the ESM-only `ai` package —
// Jest can't parse it un-mocked. Same fix as __tests__/envelopes.test.js.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const mockCategoryFindAll = jest.fn();
const mockCategoryFindOne = jest.fn();
const mockCategoryCreate = jest.fn();

// Mock at the models boundary, same shape as __tests__/envelopes.test.js —
// the DB stays fully mocked here; CI's real Postgres run exercises the
// actual schema.
jest.mock('../models', () => ({
  Category: {
    findAll: (...args) => mockCategoryFindAll(...args),
    findOne: (...args) => mockCategoryFindOne(...args),
    create: (...args) => mockCategoryCreate(...args),
  },
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const UNKNOWN_CATEGORY_ID = 999;

function authHeader(role = 'admin', userId = 1) {
  const token = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

function adminAuthHeader() {
  return authHeader('admin');
}

function userAuthHeader() {
  return authHeader('user');
}

/** Builds a fake Sequelize instance with the instance methods the service calls. */
function makeCategoryInstance(data) {
  const state = { ...data };
  return {
    get id() {
      return state.id;
    },
    get name_en() {
      return state.name_en;
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

describe('GET /api/admin/categories', () => {
  it('lists the full catalog, including inactive rows', async () => {
    mockCategoryFindAll.mockResolvedValue([
      makeCategoryInstance({ id: 1, name_he: 'מזון', name_en: 'Food', color: '#f97316', is_active: true, created_at: new Date() }),
      makeCategoryInstance({ id: 2, name_he: 'אחר', name_en: 'Other', color: '#a1a1aa', is_active: false, created_at: new Date() }),
    ]);

    const res = await request(app).get('/api/admin/categories').set('Authorization', adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: 1, name_en: 'Food' }),
      expect.objectContaining({ id: 2, name_en: 'Other', is_active: false }),
    ]);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/admin/categories');
    expect(res.status).toBe(401);
    expect(mockCategoryFindAll).not.toHaveBeenCalled();
  });

  it('rejects with 403 for a non-admin token', async () => {
    const res = await request(app).get('/api/admin/categories').set('Authorization', userAuthHeader());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    expect(mockCategoryFindAll).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/categories', () => {
  it('creates a category', async () => {
    mockCategoryFindOne.mockResolvedValue(null);
    mockCategoryCreate.mockResolvedValue(
      makeCategoryInstance({ id: 5, name_he: 'ביגוד', name_en: 'Clothing', color: '#eab308', is_active: true, created_at: new Date() })
    );

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', adminAuthHeader())
      .send({ name_he: 'ביגוד', name_en: 'Clothing', color: '#eab308' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ id: 5, name_en: 'Clothing' }));
    expect(mockCategoryCreate).toHaveBeenCalledWith(expect.objectContaining({ name_en: 'Clothing', is_active: true }));
  });

  it('rejects a missing name_he without creating anything', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', adminAuthHeader())
      .send({ name_en: 'Clothing' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: name_he');
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name_en', async () => {
    mockCategoryFindOne.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', adminAuthHeader())
      .send({ name_he: 'מזון', name_en: 'Food' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate');
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });

  it('rejects with 403 for a non-admin token', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', userAuthHeader())
      .send({ name_he: 'מזון', name_en: 'Food' });

    expect(res.status).toBe(403);
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });
});

describe('PUT /api/admin/categories/:id', () => {
  it('partially updates a category', async () => {
    mockCategoryFindOne.mockResolvedValue(
      makeCategoryInstance({ id: 5, name_he: 'ביגוד', name_en: 'Clothing', color: '#eab308', is_active: true, created_at: new Date() })
    );

    const res = await request(app)
      .put('/api/admin/categories/5')
      .set('Authorization', adminAuthHeader())
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });

  it('rejects an empty body', async () => {
    const res = await request(app)
      .put('/api/admin/categories/5')
      .set('Authorization', adminAuthHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: body');
  });

  it('returns 404 for an unknown id', async () => {
    mockCategoryFindOne.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/admin/categories/${UNKNOWN_CATEGORY_ID}`)
      .set('Authorization', adminAuthHeader())
      .send({ is_active: false });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  it('deletes a category', async () => {
    const instance = makeCategoryInstance({ id: 5, name_he: 'ביגוד', name_en: 'Clothing', color: '#eab308', is_active: true, created_at: new Date() });
    mockCategoryFindOne.mockResolvedValue(instance);

    const res = await request(app).delete('/api/admin/categories/5').set('Authorization', adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5 });
    expect(instance.destroy).toHaveBeenCalled();
  });

  it('returns 404 for an unknown id and never calls destroy', async () => {
    mockCategoryFindOne.mockResolvedValue(null);

    const res = await request(app).delete(`/api/admin/categories/${UNKNOWN_CATEGORY_ID}`).set('Authorization', adminAuthHeader());

    expect(res.status).toBe(404);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/admin/categories/5');
    expect(res.status).toBe(401);
    expect(mockCategoryFindOne).not.toHaveBeenCalled();
  });
});
