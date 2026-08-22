'use strict';

// No uniqueness ever existed on envelopes.name — duplicate categories per
// (user_id, month) were fully allowed. docs/features/HOMEPAGE-FIXES.md § 3.4.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Rename pre-existing duplicates before the constraint goes on, or this
    // migration fails outright on any user who already has one. Keeps the
    // lowest id's name as-is and appends " (2)", " (3)", ... to the rest,
    // per (user_id, month, name) group — same idea as CLAUDE.md's "migrations
    // are the source of truth for schema," just resolving bad data first.
    await queryInterface.sequelize.query(`
      WITH duplicates AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id, month, name ORDER BY id
        ) AS rn
        FROM envelopes
      )
      UPDATE envelopes
      SET name = envelopes.name || ' (' || duplicates.rn || ')'
      FROM duplicates
      WHERE envelopes.id = duplicates.id AND duplicates.rn > 1
    `);

    await queryInterface.addConstraint('envelopes', {
      fields: ['user_id', 'month', 'name'],
      type: 'unique',
      name: 'envelopes_user_id_month_name_key',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('envelopes', 'envelopes_user_id_month_name_key');
    // Renamed duplicates from the up migration are not reverted — same
    // limitation as every other data-repairing migration; the rename is
    // harmless (still a valid, user-owned envelope name) and not worth
    // tracking which rows were touched just to undo cosmetically.
  },
};
