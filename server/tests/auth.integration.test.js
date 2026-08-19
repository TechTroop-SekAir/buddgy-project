'use strict';

// Real-Postgres integration tests for ticket B-03 (register/login/me) —
// server/__tests__/ has no dedicated auth suite at all (only adminUsers.test.js
// exercises login incidentally, DB-mocked). This is the first real coverage
// of the auth flow against actual constraints (unique email) and actual
// requireAuth (server/middleware/auth.js), which does a real per-request
// User lookup as of ticket B-08 — see .claude/commands/qa.md § Test Layers.
//
// Run via `npm run test:integration` only — that script points DATABASE_URL
// at DATABASE_URL_TEST (server/scripts/runWithTestDb.js). helpers/db.js
// additionally refuses to truncate a database whose name doesn't end in
// "_test", as a second guard against ever touching dev data.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// app.js pulls in routes/transactions.js -> controllers/transactionsController.js
// -> services/claudeService.js, which requires the ESM-only `ai` package —
// Jest can't parse it un-mocked. Same fix as every server/__tests__/ file.
// Unrelated to the real-DB point of this suite — Claude/Google stay mocked
// even here per docs/TESTING.md § Mocking Policy.
jest.mock('../services/claudeService', () => ({
  parseQuickEntry: jest.fn(),
  detectColumnMapping: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUser, authHeader, FIXTURE_PASSWORD } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token, ignoring a caller-supplied role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new-user@test.buddgy.com', password: 'longenough1', full_name: 'New User', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: 'new-user@test.buddgy.com',
      full_name: 'New User',
      role: 'user', // never trusts a client-supplied role — server/services/authService.js hardcodes 'user'
      connected: false,
      onboarding_completed_at: null,
    });

    // The token must actually authenticate against the real DB row just created.
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('new-user@test.buddgy.com');
  });

  it('rejects a duplicate email with 409, backed by the real unique constraint', async () => {
    await createUser({ email: 'taken@test.buddgy.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@test.buddgy.com', password: 'longenough1' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ data: null, error: 'duplicate' });
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'longenough1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: email');
  });

  it('rejects a too-short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short-pw@test.buddgy.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed: password');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await createUser({ email: 'login@test.buddgy.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.buddgy.com', password: FIXTURE_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('login@test.buddgy.com');
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('rejects the wrong password', async () => {
    await createUser({ email: 'wrong-pw@test.buddgy.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong-pw@test.buddgy.com', password: 'definitely-wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthorized' });
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.buddgy.com', password: FIXTURE_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects a disabled user with the same generic message as a bad password (ticket B-08)', async () => {
    await createUser({ email: 'disabled@test.buddgy.com', disabled: true });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disabled@test.buddgy.com', password: FIXTURE_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthorized' });
  });
});

describe('GET /api/auth/me', () => {
  it('returns the caller for a valid token', async () => {
    const user = await createUser({ email: 'me@test.buddgy.com', full_name: 'Me User' });

    const res = await request(app).get('/api/auth/me').set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, email: 'me@test.buddgy.com', full_name: 'Me User' });
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a token for a user that no longer exists', async () => {
    const token = jwt.sign({ sub: 999999, role: 'user' }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('revokes an existing, still-unexpired token the instant the user is disabled (ticket B-08, real DB round trip)', async () => {
    const user = await createUser({ email: 'revoke-me@test.buddgy.com' });
    const header = authHeader(user);

    const before = await request(app).get('/api/auth/me').set('Authorization', header);
    expect(before.status).toBe(200);

    await user.update({ disabled: true });

    const after = await request(app).get('/api/auth/me').set('Authorization', header);
    expect(after.status).toBe(401);
    expect(after.body).toEqual({ data: null, error: 'unauthorized' });
  });
});

describe('PATCH /api/auth/onboarding', () => {
  it('sets onboarding_completed_at, visible on a subsequent /me call', async () => {
    const user = await createUser({ email: 'onboarding@test.buddgy.com' });
    const header = authHeader(user);

    const before = await request(app).get('/api/auth/me').set('Authorization', header);
    expect(before.body.data.user.onboarding_completed_at).toBeNull();

    const res = await request(app).patch('/api/auth/onboarding').set('Authorization', header);
    expect(res.status).toBe(200);
    expect(res.body.data.user.onboarding_completed_at).toEqual(expect.any(String));

    const after = await request(app).get('/api/auth/me').set('Authorization', header);
    expect(after.body.data.user.onboarding_completed_at).toEqual(res.body.data.user.onboarding_completed_at);
  });

  it('is idempotent — a second call does not move an already-recorded timestamp', async () => {
    const user = await createUser({ email: 'idempotent-onboarding@test.buddgy.com' });
    const header = authHeader(user);

    const first = await request(app).patch('/api/auth/onboarding').set('Authorization', header);
    const second = await request(app).patch('/api/auth/onboarding').set('Authorization', header);

    expect(second.status).toBe(200);
    expect(second.body.data.user.onboarding_completed_at).toBe(first.body.data.user.onboarding_completed_at);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).patch('/api/auth/onboarding');
    expect(res.status).toBe(401);
  });
});
