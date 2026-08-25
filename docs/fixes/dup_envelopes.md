# Task: Merge pre-existing duplicate envelopes (data repair, not a live bug)

## Context

Migration `20260822000200-unique-envelope-name-per-month.js` added a unique constraint on
`envelopes(user_id, month, name)`. Before that migration, no uniqueness existed at any layer, so
users could — and did — create multiple envelopes with the same name in the same month.

To make the constraint installable, the migration's `up()` renamed pre-existing duplicates instead
of merging them: for each `(user_id, month, name)` group, the lowest-`id` row kept its name and
every other row got `" (2)"`, `" (3)"`, etc. appended (`ROW_NUMBER() OVER (PARTITION BY user_id,
month, name ORDER BY id)`).

The result: real users now have pairs like `מתנות` / `מתנות (2)` and `חיות מחמד` / `חיות מחמד (2)`
showing up as separate envelope cards on the dashboard, each with its own slice of what used to be
one budget, and its own subset of transactions. This is confusing and wrong from a product
standpoint — these are the same logical category, just split across two rows because they were
duplicated back when nothing stopped that.

**The uniqueness enforcement itself (service-level check in `envelopeService.js` +
the DB constraint) is correct and should not be touched.** This task is purely a data-repair
migration for envelopes that were split before that constraint existed.

## What "duplicate" means here, precisely

A duplicate pair is: two (or more) rows in `envelopes` with the same `user_id` and `month`, where
one row's `name` equals another row's `name` with a `" (N)"` suffix appended (N = 2, 3, ...), for
some other existing row sharing that base name. Detect it with the same pattern the original
migration used to create it — do not rely on some other heuristic (e.g. Levenshtein/fuzzy match) to
avoid touching legitimate user-chosen names that happen to end in `" (2)"` for unrelated reasons
outside this specific PARTITION BY pattern.

Concretely: for each `(user_id, month)`, group rows whose `name` matches `^(.+) \(\d+\)$` with the
row whose `name` equals that captured base string exactly. The base-name row (lowest id in the
original group) is the canonical survivor.

## Schema constraints that matter (read before writing the migration)

Two other tables reference `envelopes.id` and **both use `onDelete: 'SET NULL'`**, not CASCADE:

- `transactions.envelope_id` (`server/migrations/20260809000300-create-transactions.js`)
- `planned_expenses.envelope_id` (`server/migrations/20260809000400-create-planned-expenses.js`)

This means a naive `DELETE FROM envelopes WHERE ...duplicate...` will silently set
`envelope_id = NULL` on every transaction and planned expense that pointed at the deleted
duplicate row — i.e. it uncategorizes real financial data instead of merging it. **This must not
happen.** Every `transactions` and `planned_expenses` row pointing at a duplicate envelope must be
re-pointed to the canonical envelope's id *before* the duplicate row is deleted.

## Expected fix

A new forward-only migration, following the existing project convention (see
`server/migrations/20260822000200-unique-envelope-name-per-month.js` for the pattern/style,
`server/CLAUDE.md` and `docs/DATABASE.md` for migration conventions — read both first). Filename
should sort after the latest existing migration, e.g.
`server/migrations/<next-timestamp>-merge-duplicate-envelopes.js`.

The `up()` should, per `(user_id, month, base_name)` group with more than one row:

1. Identify the canonical row (lowest `id` in the group — this is the one that kept the base name,
   per the original rename migration's own `ORDER BY id` logic).
2. Sum `monthly_budget_agorot` across all rows in the group into the canonical row.
3. Re-point `UPDATE transactions SET envelope_id = <canonical_id> WHERE envelope_id IN (<duplicate
   ids>)`.
4. Re-point `UPDATE planned_expenses SET envelope_id = <canonical_id> WHERE envelope_id IN
   (<duplicate ids>)`.
5. Delete the duplicate rows from `envelopes`.

Do all of this in a single transaction per group (or one transaction for the whole migration —
match whatever pattern the codebase's other multi-step migrations use).

**Idempotency:** the migration must be safe to run twice without error or double-summing budgets —
after the first run there will be no more `" (N)"`-suffixed names left in a group with a matching
base row, so a second run should find nothing to do. Verify this explicitly, don't just assume it.

**`color`:** decide what happens to the duplicate's `color` field when merging (canonical row's
color wins — don't overwrite it). State this explicitly in a migration comment, matching the
project's convention of a comment block explaining every non-obvious decision (see the referenced
migration for the house style).

## What NOT to change

- Do not touch `assertNameAvailable`, the `envelopes_user_id_month_name_key` constraint, or any
  create/update validation logic — that part is already correct and shipped.
- Do not attempt to "fix" this from the application/service layer — this is one-time historical
  data cleanup and belongs in a migration, per the project's own stated convention that migrations
  are the source of truth for schema and data-repair changes (see the comment header in
  `20260822000200-unique-envelope-name-per-month.js`).

## Acceptance criteria / how I'll verify this is done

1. Run the migration against a copy of the current data. For every `(user_id, month)` that had a
   `" (2)"`-style pair before, there is now exactly one envelope row, with `monthly_budget_agorot`
   equal to the sum of what the pair had.
2. Every transaction and planned expense that was pointed at a duplicate's id before the migration
   still points at *an* envelope (the canonical one) after — zero rows flip to `envelope_id = NULL`
   as a side effect of this migration. Write a test asserting this count explicitly, not just that
   the envelope row is gone.
3. Running the migration a second time is a no-op (no error, no double-summed budgets).
4. `down()` — per the project's own convention (see the referenced migration's `down()` comment),
   this kind of data repair is not expected to be perfectly reversible; state that limitation in a
   comment rather than attempting a fake revert, matching house style.
5. Add/extend tests in `server/tests/envelopes.integration.test.js` (or `server/__tests__/`,
   whichever the existing migration-adjacent tests use) covering the merge.
6. Full Jest suite passes.

## One open product question — flag it, don't guess

If a user has *three or more* rows in the same group (e.g. name, name (2), name (3)), or if the
duplicate rows have different `color` values, confirm the "sum budgets, canonical wins on
everything else" rule is actually what's wanted before merging — this is a business-logic choice,
not just an engineering one. Surface it rather than silently picking one.