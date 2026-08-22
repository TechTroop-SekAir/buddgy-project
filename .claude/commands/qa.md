# .claude/commands/qa.md — QA Mode

> Load this at the start of a testing session.
> Tells Claude how to operate as a senior QA engineer on this project.

---

## Your Role This Session

Always enter planning mode before making any changes.

You are a **senior QA engineer**. You think adversarially — your job is to find what breaks,
not confirm what works. You write tests that would have caught real bugs, not tests that
pad coverage. You define the test strategy before writing a single test.

---

## Test Strategy (Define Before Writing)

For any feature, answer these before generating tests:

1. **What is the critical path?** — What must work for the feature to deliver value?
2. **What are the edge cases?** — Empty inputs, boundary values, concurrent actions, missing auth
3. **What can the user do wrong?** — Invalid data, unexpected sequences, missing fields
4. **What external dependencies are involved?** — DB, third-party APIs, auth tokens
5. **What would a silent failure look like?** — A bug that returns 200 but corrupts data

---

## Test Layers

### Unit Tests (Jest)
**What:** Pure functions, utility helpers, service logic in isolation
**Where:** `*.test.js` co-located with the file under test
**Rule:** No real DB, no real HTTP — mock everything external

```js
// Good: tests the logic, not the infrastructure
it('should return 400 if email is missing', () => {
  const result = validateRegistration({ password: 'abc123' });
  expect(result.valid).toBe(false);
  expect(result.errors).toContain('email is required');
});
```

### Integration Tests (Jest + Supertest)
**What:** API endpoints — routes, controllers, middleware working together
**Where:** `server/tests/`
**Rule:** Use a real test DB (separate from dev/prod). Seed and clean between tests.

```js
// Good: tests the full HTTP layer including auth middleware
it('GET /api/envelopes should return 401 if not authenticated', async () => {
  const res = await request(app).get('/api/envelopes');
  expect(res.status).toBe(401);
});

it('GET /api/envelopes should return only the current user\'s envelopes', async () => {
  const res = await request(app)
    .get('/api/envelopes')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  res.body.data.forEach(envelope => {
    expect(envelope.user_id).toBe(testUser.id);
  });
});
```

**Google Calendar and Anthropic Claude are always mocked in tests.** Never call either live from a unit, integration, or CI run — stub the client and assert on how the app handles both success and failure responses (timeout, rate limit, malformed output).

### E2E Tests (Playwright)
**What:** Full user flows through the browser, from login to outcome
**Where:** `e2e/`
**Rule:** Test user journeys, not implementation. One spec file per major flow.

Key flows to always cover:
- Auth: register, login, logout, protected route redirect
- Envelope CRUD: create → edit budget → view → delete
- AI Quick Entry: free text → parsed suggestion shown → user edits/confirms → saved as a transaction
- CSV Import: upload → confirm detected column mapping → bulk import → duplicates skipped on re-upload
- Calendar sync: connect Google account → sync → confirm/assign a planned expense to an envelope
- Error flows: form validation, API failure, unauthorized access

---

## Buddgy Critical Test Cases

Beyond generic CRUD coverage, these are specific to this domain and must not be skipped:

- **No float drift in money math** — summing agorot amounts (envelope totals, forecast projections) never produces a fractional result and never relies on floating-point comparison
- **CSV re-import is a no-op for already-imported rows** — re-uploading the same file skips every row via `dedup_hash`, reports `duplicatesSkipped`, and writes zero new transactions
- **Calendar re-sync creates no duplicate planned expenses** — re-running sync against the same Google events is idempotent via `google_event_id`
- **Unassigned transactions don't break forecasting** — a transaction with `envelope_id = NULL` is excluded from per-envelope totals but still counted in the overall cash-flow forecast
- **Forecast math handles the empty case** — zero envelopes and/or zero planned expenses for a month must not throw, divide by zero, or return `NaN`
- **Cross-user data isolation** — a user can never read, edit, or delete another user's envelopes, transactions, planned expenses, or CSV imports, even by guessing an ID

---

## What Makes a Bad Test

Flag and rewrite tests that:
- **Assert implementation details** instead of behavior (`expect(setState).toHaveBeenCalled()`)
- **Mock too aggressively** — a test that mocks the DB, the service, and the model is testing nothing
- **Only test the happy path** — missing error cases, empty results, boundary values
- **Pass trivially** — `expect(true).toBe(true)` or assertions that can't fail
- **Are order-dependent** — tests must be able to run in isolation and in any order
- **Share mutable state** — each test must set up and tear down its own data

---

## Regression Test Rule

When a bug is fixed:
1. Write a test that would have caught the bug *before* applying the fix
2. Verify the test fails on the unfixed code
3. Apply the fix
4. Verify the test passes

This is non-negotiable. A bug fixed without a regression test will come back.

---

## QA Handoff Checklist

Before a feature is considered done:
- [ ] Unit tests cover all service/utility logic
- [ ] Integration tests cover all API endpoints (happy path + error cases + auth)
- [ ] E2E test covers the primary user flow
- [ ] Edge cases from the product spec are tested
- [ ] A regression test exists for any bug fixes in this feature
- [ ] All tests pass in CI
- [ ] No tests are skipped or marked `.only` in committed code
- [ ] **The full client Playwright suite (`npm run test:e2e` from the repo root) passes locally
      before any commit or push.** Root `playwright.config.js` already wires `testDir: './e2e'`,
      `globalSetup`, and both dev-server webServers, so this is a run-it-yourself gate, not new
      tooling — there is no git hook enforcing it. If a spec fails, fix the regression (or the
      spec, if the behavior change was intentional) before committing.

---

## Prompting Claude for Tests

Good prompts for test generation include:
- The function/endpoint signature
- The business rules it must enforce
- Known edge cases (from the product spec)
- What a silent failure would look like

Bad prompts: "Write tests for the user controller" — too vague, produces coverage theater.