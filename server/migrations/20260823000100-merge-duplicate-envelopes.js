'use strict';

// Data repair, not a live bug — see docs/fixes/dup_envelopes.md. Migration
// 20260822000200 added the envelopes(user_id, month, name) unique constraint
// by *renaming* every pre-existing duplicate ('" (2)"', '" (3)"', ... appended
// via ROW_NUMBER() OVER (PARTITION BY user_id, month, name ORDER BY id))
// instead of merging it. That left real users with split pairs like
// "מתנות" / "מתנות (2)" showing up as two dashboard cards for what was one
// logical category. assertNameAvailable (server/services/envelopeService.js)
// and the DB constraint already stop *new* duplicates from forming — this
// migration only cleans up rows split before that shipped.
//
// Detection is the exact inverse of the rename migration's own pattern: a
// row whose name matches '^(.+) \(\d+\)$' merges into the row in the same
// (user_id, month) whose name equals the captured base string exactly. This
// is deliberately not a fuzzy match — a user who happens to have legitimately
// named an envelope "Gift (2)" next to a "Gift" is indistinguishable from
// the rename migration's output by construction, and gets merged too. That
// is an accepted, known limitation of reversing this specific rename.
//
// Every other migration in this repo is a single statement, so none opens a
// transaction explicitly. This one is a genuine multi-step write (sum
// budgets -> re-point FKs -> delete rows), and CLAUDE.md requires a
// transaction for that shape of change: transactions.envelope_id and
// planned_expenses.envelope_id are both ON DELETE SET NULL (not CASCADE), so
// a bare DELETE without re-pointing first would silently uncategorize real
// financial data, and a partial failure between steps would do the same.
//
// color: the canonical (lowest-id / base-name) row's color is left as-is;
// the duplicates' colors are discarded. monthly_budget_agorot is summed
// across the whole group into the canonical row.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // One CTE, reused by every statement below, mapping each duplicate's
      // id to its canonical (base-name) row's id within the same
      // (user_id, month). Idempotent by construction: once a duplicate is
      // merged and deleted, no remaining "(N)"-suffixed row has a matching
      // base row left, so this CTE (and every statement built on it)
      // returns nothing on a second run.
      const mergesCte = `
        WITH merges AS (
          SELECT dup.id AS dup_id, base.id AS canonical_id
          FROM envelopes dup
          JOIN envelopes base
            ON base.user_id = dup.user_id
           AND base.month = dup.month
           AND base.name = regexp_replace(dup.name, '^(.+) \\(\\d+\\)$', '\\1')
          WHERE dup.name ~ '^.+ \\(\\d+\\)$'
        )
      `;

      // 1. Sum budgets into the canonical row before anything is deleted.
      await queryInterface.sequelize.query(
        `
        ${mergesCte}
        UPDATE envelopes
        SET monthly_budget_agorot = envelopes.monthly_budget_agorot + dup_sums.total
        FROM (
          SELECT merges.canonical_id, SUM(d.monthly_budget_agorot) AS total
          FROM merges
          JOIN envelopes d ON d.id = merges.dup_id
          GROUP BY merges.canonical_id
        ) dup_sums
        WHERE envelopes.id = dup_sums.canonical_id
      `,
        { transaction }
      );

      // 2. Re-point transactions off the duplicates before they're deleted —
      // required because transactions.envelope_id is ON DELETE SET NULL.
      await queryInterface.sequelize.query(
        `
        ${mergesCte}
        UPDATE transactions
        SET envelope_id = merges.canonical_id
        FROM merges
        WHERE transactions.envelope_id = merges.dup_id
      `,
        { transaction }
      );

      // 3. Same re-point for planned_expenses (also ON DELETE SET NULL).
      await queryInterface.sequelize.query(
        `
        ${mergesCte}
        UPDATE planned_expenses
        SET envelope_id = merges.canonical_id
        FROM merges
        WHERE planned_expenses.envelope_id = merges.dup_id
      `,
        { transaction }
      );

      // 4. Now safe to delete the duplicate rows — nothing still points at them.
      await queryInterface.sequelize.query(
        `
        ${mergesCte}
        DELETE FROM envelopes
        USING merges
        WHERE envelopes.id = merges.dup_id
      `,
        { transaction }
      );
    });
  },

  down: async () => {
    // Not reversible: the pre-merge budget split and the deleted duplicate
    // rows' ids are gone. Same limitation as every other data-repair
    // migration in this project (see 20260822000200's down()) — a fake
    // revert that can't restore the original split would be worse than
    // stating the limitation outright.
  },
};
