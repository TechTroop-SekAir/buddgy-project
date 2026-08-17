'use strict';

// Real-Postgres integration tests for ticket B-06 (admin category catalog).
// Proves the real `name_en` UNIQUE constraint round-trips as 409, not just
// the mocked assertNameAvailable pre-check server/__tests__/adminCategories.test.js
// already covers.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, createCategory, authHeader } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/admin/categories', () => {
  it('lists the full catalog, including inactive rows, admin only', async () => {
    const admin = await createUser({ role: 'admin' });
    await createCategory({ name_he: 'מזון', name_en: 'Food', is_active: true });
    await createCategory({ name_he: 'ישן', name_en: 'Retired', is_active: false });

    const res = await request(app).get('/api/admin/categories').set('Authorization', authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((c) => c.is_active).sort()).toEqual([false, true]);
  });

  it('rejects a non-admin with 403', async () => {
    const user = await createUser({ role: 'user' });
    const res = await request(app).get('/api/admin/categories').set('Authorization', authHeader(user));
    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/admin/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/categories', () => {
  it('creates a category', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', authHeader(admin))
      .send({ name_he: 'תחבורה', name_en: 'Transportation', color: '#3b82f6' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name_he: 'תחבורה', name_en: 'Transportation', is_active: true });
  });

  it('rejects a duplicate name_en with 409, backed by the real unique constraint', async () => {
    const admin = await createUser({ role: 'admin' });
    await createCategory({ name_en: 'Food' });

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', authHeader(admin))
      .send({ name_he: 'אחר', name_en: 'Food' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ data: null, error: 'duplicate' });
  });

  it('rejects a missing name_he', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', authHeader(admin))
      .send({ name_en: 'NoHebrewName' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/admin/categories/:id', () => {
  it('partially updates a category', async () => {
    const admin = await createUser({ role: 'admin' });
    const category = await createCategory({ name_en: 'ToRename' });

    const res = await request(app)
      .put(`/api/admin/categories/${category.id}`)
      .set('Authorization', authHeader(admin))
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });

  it('rejects renaming to another category\'s name_en with 409', async () => {
    const admin = await createUser({ role: 'admin' });
    await createCategory({ name_en: 'Taken' });
    const category = await createCategory({ name_en: 'Mine' });

    const res = await request(app)
      .put(`/api/admin/categories/${category.id}`)
      .set('Authorization', authHeader(admin))
      .send({ name_en: 'Taken' });

    expect(res.status).toBe(409);
  });

  it('rejects an empty body', async () => {
    const admin = await createUser({ role: 'admin' });
    const category = await createCategory();
    const res = await request(app).put(`/api/admin/categories/${category.id}`).set('Authorization', authHeader(admin)).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app)
      .put('/api/admin/categories/999999')
      .set('Authorization', authHeader(admin))
      .send({ is_active: false });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  it('hard-deletes a category', async () => {
    const admin = await createUser({ role: 'admin' });
    const category = await createCategory();

    const res = await request(app).delete(`/api/admin/categories/${category.id}`).set('Authorization', authHeader(admin));
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/admin/categories').set('Authorization', authHeader(admin));
    expect(list.body.data).toEqual([]);
  });

  it('returns 404 for an unknown id and deletes nothing', async () => {
    const admin = await createUser({ role: 'admin' });
    const category = await createCategory();

    const res = await request(app).delete('/api/admin/categories/999999').set('Authorization', authHeader(admin));
    expect(res.status).toBe(404);

    const list = await request(app).get('/api/admin/categories').set('Authorization', authHeader(admin));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(category.id);
  });
});
