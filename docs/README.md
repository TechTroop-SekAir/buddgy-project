# Buddgy — Docs Index

This directory is the single source of truth for the Buddgy spec.

**Every file below starts with its own `## Contents` table. Read that table first, then jump to only the sections a task needs — see `CLAUDE.md` § Reading the Docs.**

| File | Covers |
|---|---|
| [`OVERVIEW.md`](./OVERVIEW.md) | Team, product description, target users, use cases, mockups, extensions |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Layer topology, request lifecycle, the three input-channel flows, forecast logic, deployment shape |
| [`DATABASE.md`](./DATABASE.md) | All tables, columns, indexes, idempotency constraints, migration conventions |
| [`API.md`](./API.md) | Every endpoint, request/response shapes, error catalog |
| [`STATE.md`](./STATE.md) | Client state strategy — React Query keys, form state, money-at-the-boundary rule |
| [`INTEGRATIONS.md`](./INTEGRATIONS.md) | Claude, Google Calendar, Cloudinary/S3 — what each does and how failures are handled |
| [`SECURITY.md`](./SECURITY.md) | Permission matrix, row-level access, JWT lifecycle, secrets |
| [`DESIGN.md`](./DESIGN.md) | Palette, tokens, status colors, responsive breakpoints, the Mantine boundary |
| [`TESTING.md`](./TESTING.md) | Test strategy, coverage targets, Buddgy-critical cases, mocking policy |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Railway setup, environments, release process, smoke checks |
| [`PLAN.md`](./PLAN.md) | The 12-day delivery board, tracks, critical path, risk register |

For **how Claude should work** (process, not spec), see `.claude/commands/`: `/dev`, `/product`, `/qa`, `/design`. These reference the files above rather than repeating them — if something looks duplicated, the command file should be pointing here instead.
