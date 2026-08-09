# Buddgy — Security

## Contents

| Section | What's in it |
|---|---|
| [Permission Matrix](#permission-matrix) | What Guest / User / Admin can each do |
| [Row-Level Access](#row-level-access) | Why "authenticated" isn't enough |
| [JWT Lifecycle](#jwt-lifecycle) | Issue, verify, expire |
| [Secrets](#secrets) | Encryption, env vars, what never gets logged |
| [Input & Upload Safety](#input--upload-safety) | Validation, file constraints |

Related specs: [`API.md`](./API.md) · [`DATABASE.md`](./DATABASE.md) · [`INTEGRATIONS.md`](./INTEGRATIONS.md)

---

## Permission Matrix

| Action | Guest | Registered User | Admin |
|---|---|---|---|
| View landing page / method explanation | ✅ | ✅ | ✅ |
| View read-only demo dashboard | ✅ | ✅ | ✅ |
| Register / log in | ✅ | — | — |
| Manage own envelopes/transactions | ❌ | ✅ | ✅ |
| Quick entry, CSV import, calendar sync | ❌ | ✅ | ✅ |
| View own forecast | ❌ | ✅ | ✅ |
| Manage global category catalog | ❌ | ❌ | ✅ |
| View/disable users | ❌ | ❌ | ✅ |
| View usage stats | ❌ | ❌ | ✅ |

Enforced by `middleware/auth.js` (authenticated?) composed with a `requireRole('admin')` middleware, applied at the router level — never as an `if` inside a controller (`CLAUDE.md` § Non-Negotiables).

## Row-Level Access

Being authenticated is necessary but not sufficient — a valid token for User A must never be able to read/edit/delete User B's data. Every query for envelopes, transactions, planned expenses, and CSV imports **must filter by `user_id = req.user.id`**, not just by the resource's own `id`. This is the single most important thing to test — see `.claude/commands/qa.md` § Buddgy Critical Test Cases ("Cross-user data isolation").

Admin routes are the only ones that legitimately read across users, and they expose aggregate/list views, never another user's raw envelope/transaction data.

## JWT Lifecycle

- Issued on register/login, signed with `JWT_SECRET`, contains `{ userId, role }` — never anything sensitive (no password hash, no tokens)
- Verified in `middleware/auth.js` on every protected route
- Expiry: short-lived enough to limit blast radius from a leaked token; exact TTL is a Track B decision to record here once set
- No refresh-token flow for the app's own auth (JWT re-login on expiry is acceptable for an MVP) — **do not confuse this with `google_refresh_token`**, which is a separate, long-lived OAuth credential

## Secrets

- `google_refresh_token` is **encrypted at rest** (application-level encryption before the INSERT, not just relying on disk encryption) and is never included in any API response, log line, or error message
- All other secrets (`JWT_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, `CLOUDINARY_URL`) live only in `.env` / the deployment platform's secret store — see `CLAUDE.md` § Environment Variables
- Error responses sent to the client never include stack traces or internal details (`CLAUDE.md` § Error Handling)

## Input & Upload Safety

- All request bodies validated in middleware before reaching a controller (`express-validator` or `zod`)
- CSV/Excel uploads: validate MIME type and size limit before accepting the file, before it ever reaches `storageService`
- Profile picture uploads: validate image type/size the same way
- Free text sent to Claude for parsing is user input — treat the model's output as untrusted data too (validate the returned JSON shape before using it, don't `eval` or blind-trust it)
