import { TOKEN_KEY } from './api';

// Fake backend for ticket A-04 — built to docs/API.md's Auth contract exactly
// so authService.js can swap this out for the real implementation on ticket
// A-09 without touching any call site. "Users" persist to localStorage (not
// just in memory) so a page refresh during dev still resolves an existing
// session via /auth/me, matching how a real backend would behave.
const USERS_KEY = 'buddgy_mock_users';

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? new Map(JSON.parse(raw)) : new Map();
  } catch {
    return new Map();
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify([...users]));
}

const fakeUsers = loadUsers();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function encodeToken(payload) {
  return `mock.${btoa(JSON.stringify(payload))}.token`;
}

function decodeToken(token) {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
}

function assertPresent({ email, password }) {
  if (!email) throw new Error('validation failed: email');
  if (!password) throw new Error('validation failed: password');
}

export async function register({ email, password }) {
  await delay(300);
  assertPresent({ email, password });
  if (fakeUsers.has(email)) throw new Error('duplicate');

  const user = { id: crypto.randomUUID(), email, role: 'user' };
  fakeUsers.set(email, { user, password });
  saveUsers(fakeUsers);

  return { token: encodeToken({ userId: user.id, role: user.role }), user };
}

export async function login({ email, password }) {
  await delay(300);
  assertPresent({ email, password });

  const record = fakeUsers.get(email);
  if (!record || record.password !== password) throw new Error('unauthorized');

  return { token: encodeToken({ userId: record.user.id, role: record.user.role }), user: record.user };
}

export async function me() {
  await delay(150);

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('unauthorized');

  let payload;
  try {
    payload = decodeToken(token);
  } catch {
    throw new Error('unauthorized');
  }

  const record = [...fakeUsers.values()].find((r) => r.user.id === payload.userId);
  if (!record) throw new Error('unauthorized');

  return { user: record.user };
}
