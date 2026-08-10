# Buddgy — Deployment

## Contents

| Section | What's in it |
|---|---|
| [Platform](#platform) | Railway, service layout |
| [Environments](#environments) | Env vars per environment |
| [Release Process](#release-process) | Migrations, build, boot order |
| [Smoke Checks](#smoke-checks) | What to verify after every deploy |

Related specs: [`ARCHITECTURE.md`](./ARCHITECTURE.md) § Deployment Shape · `CLAUDE.md` § Environment Variables

---

## Platform

Railway hosts both `client/` and `server/` as separate services from this one repo, plus a managed PostgreSQL instance. The `staging` environment is live — server and Postgres are provisioned and deploying from `main` (ticket C-01 in [`PLAN.md`](./PLAN.md), completed Day 2).

## Environments

Two Railway environments: `staging` (auto-deploys on push to `main`) and `production`-equivalent for demo day, promoted manually right before the demo so a last-minute merge can't break the live demo.

Required vars, mirrored from `CLAUDE.md` § Environment Variables, set per-environment in Railway's dashboard (never committed):

```
DATABASE_URL=
JWT_SECRET=
CLIENT_URL=
PORT=
NODE_ENV=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
CLOUDINARY_URL=
```

`GOOGLE_REDIRECT_URI` and `CLIENT_URL` differ between `staging` and the demo environment — this is the most common source of an OAuth callback breaking after a promote, check it explicitly in the smoke check below.

## Release Process

1. Push to `main` triggers the Railway build for both services
2. **Migrations run as a release step before the server process starts** — never `sync({ force: true })`, never a manual `psql` change (`CLAUDE.md` § Database Rules). The server service's Railway Start Command is `npm run db:migrate && npm start`, so this is automated on every deploy rather than run by hand.
3. Server boots only after migrations succeed; a failed migration fails the deploy rather than booting against a stale schema
4. `DATABASE_URL` is wired via Railway's variable reference to the managed Postgres instance and connects over SSL in `production`/`staging` (`server/config/config.js`)

## Smoke Checks

After every deploy to an environment about to be demoed:

- [ ] `GET /api/auth/me` with a known test token returns `200`
- [ ] Client loads and can log in
- [ ] `GET /api/calendar/connect` returns a Google consent URL pointed at the *correct* environment's `GOOGLE_REDIRECT_URI`
- [ ] `POST /api/transactions/parse` returns a parsed suggestion (Claude key valid, not rate-limited)
- [ ] A file upload (profile picture or CSV) round-trips through storage
