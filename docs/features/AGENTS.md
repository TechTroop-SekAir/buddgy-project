# Buddgy — AI Agents (Budget Advisor & Calendar Conflict)

> **Status: post-MVP extension.** Not scheduled before feature freeze (Wed Aug 19 EOD — see [`PLAN.md`](../PLAN.md) § Dates). Nothing in this document merges before the Aug 20 demo. Tracked as an extension in [`OVERVIEW.md`](../OVERVIEW.md) § Extensions; this file is the implementation-ready spec for when that work is picked up.

## Contents

| Section | What's in it |
|---|---|
| [Why Agents, Why Now vs. Later](#why-agents-why-now-vs-later) | The product case, and why this is post-freeze |
| [Architecture Decision](#architecture-decision) | Tool-use loop in `claudeService.js`, not Managed Agents/Agent SDK |
| [Design Boundaries](#design-boundaries) | What stays a single-shot parser, why one agent per job instead of a router |
| [Agent 1 — Budget Advisor](#agent-1--budget-advisor) | Free-text spending questions answered against real budget data |
| [Agent 2 — Calendar Sync Conflict Agent](#agent-2--calendar-sync-conflict-agent) | Post-sync duplicate/ambiguity detection on planned expenses |
| [API Additions (Draft)](#api-additions-draft) | New endpoints, unfrozen |
| [Database Additions (Draft)](#database-additions-draft) | New migrations, unfrozen |
| [Definition of Done](#definition-of-done) | Before any ticket below gets checked off |
| [Work Split (Post-Freeze Tickets)](#work-split-post-freeze-tickets) | Darya/Matan/Ofek, new ticket IDs |
| [Risks](#risks) | Tool-loop cost/latency, hallucination, fuzzy-match false positives |

Related specs: [`INTEGRATIONS.md`](../INTEGRATIONS.md) · [`ARCHITECTURE.md`](../ARCHITECTURE.md) · [`DATABASE.md`](../DATABASE.md) · [`API.md`](../API.md) · [`PLAN.md`](../PLAN.md)

---

## Why Agents, Why Now vs. Later

Buddgy's differentiator is already AI-in-the-loop, not AI-bolted-on: Quick Entry parses free text into a transaction, calendar sync pulls in future expenses. What's missing is the layer that *reasons* over that data instead of just recording it — a user asking "can I afford this?" today gets nothing; they'd have to open the dashboard, read every envelope balance, and do the arithmetic themselves. Two places in the existing product currently ask the user to do that arithmetic manually:

1. Deciding whether an **unplanned, unbudgeted purchase** fits this month — a question the forecast engine ([`forecastService.js`](../ARCHITECTURE.md#forecast-computation)) already has the data to answer, but never gets asked directly.
2. Reviewing **synced calendar events** — today's sync ([`INTEGRATIONS.md`](../INTEGRATIONS.md#google-calendar-api)) blindly upserts by `google_event_id`; nothing checks whether a "synced" expense already exists as a real transaction, or whether its category guess is any good.

Both are agentic in the literal sense (multi-step: gather data, reason, answer) and both reuse services that already exist. Building them well — a new tool-calling code path, tests, and doc/API changes — doesn't fit in the ~1 day left before freeze, so this is written now as a ready-to-build spec and picked up after the Aug 20 demo.

---

## Architecture Decision

**Tool-use loop inside the existing Express server**, extending `server/services/claudeService.js` — not the Claude Agent SDK, not Managed Agents (Anthropic-hosted sessions), not a deterministic-only "Claude phrases a precomputed answer" shortcut.

| Option | Why not |
|---|---|
| Anthropic Managed Agents (hosted sessions/sandboxes) | Data would need to leave our DB/API boundary into an Anthropic-hosted session; new infra (agents, environments, vaults) for a feature that only needs read access to data we already query from Node. Wrong tool for an MVP grad project on Railway. |
| Claude Agent SDK | Built for coding-agent-style harnesses with filesystem/bash tools; nothing here needs that surface. |
| Deterministic logic + Claude only phrases the sentence | Cheapest, but not what was asked for and doesn't generalize — a fixed "if over budget say X" branch can't handle "what if I move $50 from groceries" follow-ups. Reconsider only if the tool-use version proves too costly/slow in practice. |
| **Tool-use loop in `claudeService.js` (chosen)** | Runs on infra that already exists (Railway backend, existing auth, existing `ai_calls` logging); tools are just typed wrappers around services that already exist (`forecastService`, `transactionService`, etc.); no new deployment surface. |

**Model & SDK pattern.** `claudeService.js` today calls Vercel AI SDK's `generateObject()` (single-shot, no tool calling) on `claude-3-5-sonnet-20241022`, with a 15s timeout, Zod-schema output, and no retries — see [`INTEGRATIONS.md`](../INTEGRATIONS.md#anthropic-claude-api). Both new agents should:

- Use the Vercel AI SDK's tool-calling primitive (`generateText`/`streamText` with a `tools` map, or the SDK's equivalent agent-loop helper) rather than hand-rolling the tool_use/tool_result loop — this keeps the file's existing house style (Zod schemas, timeout, `ai_calls` logging) instead of introducing a second AI-call pattern.
- Move off `claude-3-5-sonnet-20241022` (deprecated, retiring) onto a current model — `claude-sonnet-5` is the right tier here: both agents are short, cheap, well-scoped reasoning tasks, not long-horizon coding work, so Opus-tier is unnecessary cost.
- Keep the existing 15s-class timeout and `logAiCall(userId, kind, succeeded)` call, extended to log the new `kind` values (see [Database Additions](#database-additions-draft)).
- Keep the same hallucination guard `parseQuickEntry` already uses: any model-returned ID (envelope ID, transaction ID) is revalidated against the caller's own allowlist before use; a reference to a nonexistent id becomes `null`/rejected, never trusted blind.

---

## Design Boundaries

**Quick Entry is not becoming an agent.** `claudeService.parseQuickEntry` — one `generateObject()` call, regex fallback (`client/src/utils/parseQuickEntryText.js`), mandatory confirmation modal (`QuickEntryModal.jsx`) — is correct as-is and stays out of scope here. It's structured extraction from a single sentence; there's no multi-step reasoning to be done and no data to look up beyond the envelope list it's already given. Turning "coffee 10 NIS" into a tool-calling agent adds latency, cost, and hallucination surface for zero user-facing benefit. If a future request needs Quick Entry to look something up (e.g. "same as last month"), that's a new, narrow tool addition to the *existing* single-shot call — not a reason to promote it to an agent.

**One purpose-built agent per job, no shared router/orchestrator agent.** Budget Advisor and Calendar Conflict are separate agents with disjoint, non-overlapping toolsets, and neither ever needs to invoke the other. A router/orchestrator layer on top of them would add a full extra model round-trip per request to make a routing decision the *entry point* already makes for free — a chat box only ever reaches the Budget Advisor; the post-sync hook only ever reaches the Calendar Conflict agent. Concretely:

- **Cost/latency**: token cost and latency scale with round-trips; a router adds one, for zero new information (the caller already knows which agent it wants).
- **Hallucination/blast radius**: each agent's toolset is small and strictly read-only. A combined toolset behind a general router is a larger surface for the model to misuse or confuse than two small ones.
- **Consistency with the codebase**: matches the existing one-service-one-purpose pattern (thin controllers, single-responsibility services) rather than introducing a new orchestration layer under time pressure.

Multi-agent orchestration is worth revisiting only if a third agent emerges whose tools genuinely overlap with one of these two — not before.

---

## Agent 1 — Budget Advisor

**Entry point:** a free-text question box (new UI, e.g. on the dashboard) — *"I need to spend 400 NIS on new tires, this is unbudgeted — how do I balance my budget without a deficit?"*

**Flow:** user question → tool-use loop (read-only) → structured verdict → shown to the user for review. **Never auto-saves anything** — this agent only answers; if the user acts on the suggestion (e.g. lowering an envelope budget, logging the expense), that goes through the existing envelope/transaction UI and endpoints, with the normal confirm-before-write flow.

### Tools

| Tool | Purpose | Backing call | Read-only |
|---|---|---|---|
| `get_envelopes` | List the user's envelopes with `monthly_budget_agorot` and current spend | `categoryService`/envelope list query (same data `EnvelopeDashboard` renders) | ✅ |
| `get_forecast` | Month's projected balance, at-risk envelopes, existing cut recommendation | `forecastService.get(userId, month)` — reuses `atRiskEnvelopes` and `recommendation.cutAgorot` rather than reimplementing that math | ✅ |
| `get_recent_transactions` (optional, only if the model asks) | Recent transactions for a given envelope, for context on *why* it's tight | `transactionService` list query, scoped to `userId` | ✅ |

No write tool is ever exposed to this agent.

### Worked example — the "unbudgeted tires" case

Input: *"I need to spend 400 NIS on new tires, this is unbudgeted. How can I balance my budget without a deficit?"*

1. Model calls `get_envelopes()` → sees there's no "car"/"tires" envelope; existing envelopes and budgets.
2. Model calls `get_forecast()` → gets `projectedBalanceAgorot`, `atRiskEnvelopes`, and the existing `recommendation` (`{ envelopeId, envelopeName, cutAgorot }`) if the month is already tight.
3. Model reasons: is `projectedBalanceAgorot − 40000` (400 NIS in agorot) still ≥ 0? If yes → "in budget, but here's the closest envelope" info-only; if no → treats the 400 NIS as an unbudgeted addition and looks for an envelope with headroom ≥ the resulting shortfall (reusing the same "largest headroom, non-essential first" logic `forecastService`'s `recommendation` already applies, rather than re-deriving a new ranking).
4. Final answer: a verdict (`in_budget` / `near_limit` / `over_budget`) plus, when over budget, which envelope to cut and by how much.

### Response schema (draft)

```json
{
  "verdict": "in_budget | near_limit | over_budget",
  "amountAgorot": 40000,
  "projectedBalanceAfterAgorot": -12000,
  "suggestion": {
    "envelopeId": 7,
    "envelopeName": "בידור",
    "cutAgorot": 12000
  },
  "explanation": "Hebrew-language explanation string, client-localized like forecast.recommendation"
}
```

Mirrors `forecastService`'s existing choice to keep `recommendation` a structured object rather than a display sentence (see [`API.md`](../API.md) § Calendar & Forecast) — wording stays client-side.

> **Implemented deviation:** the transport layer (route, controller, client bar/hook/service —
> see below) shipped ahead of the agent itself, and along the way `explanation` became
> **`explanationKey`**: a locale key, not a Hebrew sentence. The server has no locale context
> (`client/CLAUDE.md` § i18n forbids server-authored user-facing strings), so this leans on the
> exact same structured-data pattern `recommendation` already uses, one level further —
> `client/src/locales/{he,en}.json`'s `advisor.reply.*` resolves it. Carry this through when
> A-21 builds the real verdict: pick/construct an `explanationKey`, don't return prose.

### New/changed files

- `server/services/advisorService.js` — **transport shipped, agent brain not yet.** `ask(userId, text)`
  currently just logs to `ai_calls` (`kind: 'budget_advisor'`) and returns a fixed placeholder
  verdict. **Remaining A-21 scope:** replace the function body with the tool-use loop (tool
  definitions, `claudeService` calls, envelope-ID revalidation) — signature and response
  contract are frozen, don't change them.
- `server/controllers/advisorController.js`, `server/routes/advisor.js` — done: thin controller,
  router-level `requireAuth`, real `validate()` entry (`POST /api/advisor/ask`, 1–500 chars).
- `client/src/components/advisor/PromptBar.jsx` — done: the floating prompt bar (all six
  authenticated pages, via `AppShellLayout`), replacing the placeholder `BudgetAdvisorModal` this
  section originally sketched — a persistent bar, not a modal, per the design-ref mock.
- `client/src/hooks/useAdvisorPrompt.js` — done: owns the conversation state + `useMutation`.
- `client/src/services/advisorService.js` — done: client API wrapper, following `forecastService.js`.

### Error handling

Same rules as every other integration ([`INTEGRATIONS.md`](../INTEGRATIONS.md#failure-handling)): timeout/malformed response → `422`, never pass a partial object to the UI, no `console.log`, centralized error middleware. No auto-save under any failure path.

---

## Agent 2 — Calendar Sync Conflict Agent

**Trigger point:** runs immediately after `calendarSyncService.syncPlannedExpenses(userId)` completes a sync (see [`INTEGRATIONS.md`](../INTEGRATIONS.md#google-calendar-api)) — today that function upserts by `google_event_id` and stops; this agent adds a review pass over the newly-touched rows before they reach the "planned expense" review list.

### Conflict types in scope

1. **Exact-shape duplicate: calendar event vs. existing transaction.** A newly-synced `planned_expenses` row whose amount and near date already match a real `transactions` row (any `source`) — almost certainly the same real-world expense already logged manually or via CSV, about to double-count in the forecast.
2. **Fuzzy duplicate: CSV row vs. manual transaction.** Beyond `csvImportService`'s exact `dedup_hash` match (`sha256(userId:amount_agorot:transaction_date:description)`), a *near*-match — same amount, ±N days, similar description — that the hash-based check structurally can't catch because it requires exact equality on all three fields.
3. **Ambiguous/unassigned calendar events.** A synced event whose amount extraction succeeded but whose category/envelope is unclear — the agent proposes an envelope with a confidence score, same "surface confidence, never silently trust it" rule as Quick Entry.

### Tools

| Tool | Purpose | Backing call | Read-only |
|---|---|---|---|
| `get_new_planned_expenses` | The planned expenses just touched by this sync run | `plannedExpenseService`, scoped to `userId` + the sync run's touched IDs | ✅ |
| `get_transactions_near` | Transactions within an amount/date window, for duplicate checking | `transactionService`, scoped to `userId` | ✅ |
| `get_envelopes` | Same as Agent 1 — for the ambiguous-event envelope guess | shared with Budget Advisor's tool | ✅ |

No write tool exposed — flags are proposals surfaced in the existing planned-expense review UI ([`API.md`](../API.md) § Calendar & Forecast, `PATCH /api/planned-expenses/:id`), which the user approves/dismisses exactly as today.

### Fuzzy-match logic sketch

New helper (not existing code): `findFuzzyDuplicate(userId, { amountAgorot, date, description })` — candidate transactions within ± a few days and exact/near-exact amount, ranked by description similarity (e.g. simple token-overlap or Levenshtein-based score); above a threshold, surfaced as `possible_duplicate` rather than auto-merged. This is the one piece of genuinely new logic in this spec (everything else is tool wrappers around existing services); it should get its own unit tests with hand-picked near-miss cases before being trusted.

### UI surface

Flags appear inline in the existing planned-expense review list (where `PATCH /api/planned-expenses/:id` assign/approve/dismiss already happens) — a badge/banner per flagged row, not a separate screen.

---

## API Additions (Draft)

**Unfrozen — draft only, not to be built before Aug 19.** Follows the existing envelope (`{ data, error }`) and route conventions from [`API.md`](../API.md).

```
POST /api/advisor/ask          🔒  { text }                    → { verdict, amountAgorot, suggestion, explanation }
POST /api/calendar/sync        🔒  (existing, unchanged)        → { newEvents }
GET  /api/planned-expenses     🔒  (existing, unchanged — flags ride along on each row, e.g. conflictType/conflictConfidence)
```

`POST /api/advisor/ask` should go through router-level `requireAuth` and a real `validate()` middleware entry (unlike the pre-existing `/transactions/parse`, whose inline validation is a known deviation, not a pattern to copy).

## Database Additions (Draft)

**Unfrozen — draft only.** Follows [`DATABASE.md`](../DATABASE.md) conventions: snake_case, agorot integers, every migration ships both `up` and `down`.

- `ai_calls.kind` gains two new allowed values: `'budget_advisor'`, `'calendar_conflict'` (column is already a free-form string per `server/models/aiCall.js`, so this may be a docs-only change plus a CHECK-constraint update if one exists — confirm against the live migration before writing).
- `planned_expenses` gains two nullable columns for surfacing Agent 2's output without a new table:
  - `conflict_type VARCHAR(20)` — `'duplicate_transaction' | 'fuzzy_duplicate' | 'ambiguous_envelope'`, nullable
  - `conflict_confidence NUMERIC(3,2)` — 0–1, nullable

Draft migration shape (up/down, following existing `20260817000100-add-source-to-planned-expenses.js` as a template):

```js
// up: ADD COLUMN conflict_type VARCHAR(20) NULL, ADD COLUMN conflict_confidence NUMERIC(3,2) NULL
// down: DROP COLUMN conflict_confidence, DROP COLUMN conflict_type
```

---

## Definition of Done

Same bar as every other ticket in [`PLAN.md`](../PLAN.md#definition-of-done), applied to each ticket below:

- [ ] Matches this spec and `API.md`/`DATABASE.md` exactly — any deviation updates the spec in the same PR
- [ ] Tests pass, error/loading states handled, not just the happy path
- [ ] No `console.log`, no hardcoded IDs/URLs, responsive at `DESIGN.md` breakpoints (client tickets)
- [ ] Reviewed by one of the other two before merging to `main`
- [ ] Every model-returned ID is revalidated against a real allowlist before use (no blind trust of tool-call output)
- [ ] No write path added that bypasses the existing confirm-before-save UI

## Work Split (Post-Freeze Tickets)

`PLAN.md` splits work by **layer** (client / server+DB / integrations) — that's why Darya's tickets have historically been UI-only. This spec deliberately splits by **agent** instead: each person owns one agentic core end-to-end (tool definitions, the backing logic those tools call, and the response schema) plus one smaller, self-contained sub-mission. Per [`PLAN.md`](../PLAN.md#who-does-what), the ticket letter stays tied to the layer, not the person — so a person's ticket letter may not match their usual track this time; that's intentional, not a typo. **Explicitly scheduled after the Aug 20 demo** — not inserted into the current sprint.

**Shared harness (built first, blocks the other two):**

| Ticket | Owner | Core agentic piece | Sub-mission |
|---|---|---|---|
| **C-11** | Ofek | The tool-use harness in `claudeService.js` itself — the actual agent loop (Vercel AI SDK tool calling, tool-call/tool-result round-trips, iteration cap), model migration off `claude-3-5-sonnet-20241022` → `claude-sonnet-5`, `ai_calls` logging for the new `kind` values. This is the infrastructure both agents below are built on. | Migrations: `planned_expenses` conflict columns + `ai_calls.kind` values (small, self-contained, no agent logic) |

**Agent owners (each builds on C-11):**

| Ticket | Owner | Core agentic piece | Sub-mission |
|---|---|---|---|
| **A-21** | Darya | **Agent 1 — Budget Advisor**, end to end: the tool definitions (`get_envelopes`, `get_forecast`, `get_recent_transactions`) and their backing service calls, the "unbudgeted tires" reasoning path, the verdict/response schema, and the envelope-ID revalidation guard. This is real backend/agent-brain work, not UI. | `BudgetAdvisorModal` — the question box + result card that calls her own endpoint |
| **B-11** | Matan | **Agent 2 — Calendar Conflict Agent**, end to end: the tool definitions (`get_new_planned_expenses`, `get_transactions_near`) and their backing queries, the exact-duplicate and ambiguous-envelope logic, and wiring flags back onto `planned_expenses` rows via the existing `PATCH` endpoint. | The fuzzy CSV/manual-duplicate matcher (`findFuzzyDuplicate`) — isolated algorithm work with its own unit tests |

Sequencing: C-11 lands first (or at minimum its harness/tool-registration API is agreed up front) so A-21 and B-11 can write real tool functions against it rather than stubbing the loop themselves.

## Risks

| Risk | Mitigation |
|---|---|
| Tool-loop latency/cost (multiple model round-trips per question) | Cap tool calls per request (e.g. max 3 loop iterations); keep each agent's toolset minimal; log token usage via `ai_calls` to catch runaway cost early |
| Hallucinated envelope/transaction IDs | Revalidate every model-returned ID against the caller's own DB query before use — same pattern `parseQuickEntry` already applies |
| Fuzzy-match false positives (Agent 2) | Threshold-tuned, surfaced as a dismissible suggestion never an auto-merge; unit-test against a curated set of true/false near-miss pairs before shipping |
| Model migration risk (`claude-3-5-sonnet-20241022` → `claude-sonnet-5`) | Covered by the existing Anthropic model-migration checklist; re-verify `parseQuickEntry`'s existing prompt still performs well on the new model before switching every call site at once |
