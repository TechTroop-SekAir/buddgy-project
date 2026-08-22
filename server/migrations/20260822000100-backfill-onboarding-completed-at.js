'use strict';

module.exports = {
  up: async (queryInterface) => {
    // 20260820000200 added onboarding_completed_at as NULL for every existing
    // row, so every pre-existing user reads as "never onboarded" and the
    // wizard (client/src/components/onboarding/OnboardingWizardModal.jsx)
    // ambushes them on next login. Backfill anyone who already has envelope
    // or income data — they've clearly already been using the app — rather
    // than a blunt created_at cutoff, so genuinely-new empty accounts still
    // go through the wizard.
    await queryInterface.sequelize.query(`
      UPDATE users
      SET onboarding_completed_at = NOW()
      WHERE onboarding_completed_at IS NULL
        AND (
          EXISTS (SELECT 1 FROM envelopes WHERE envelopes.user_id = users.id)
          OR EXISTS (SELECT 1 FROM income_sources WHERE income_sources.user_id = users.id)
        )
    `);
  },

  down: async (queryInterface) => {
    // Only null out rows this migration itself would have set — i.e. users
    // who have envelope or income data but no other, independent reason to
    // have completed onboarding. This mirrors the up's WHERE clause so the
    // down doesn't clobber completions that happened through the wizard
    // after this migration ran.
    await queryInterface.sequelize.query(`
      UPDATE users
      SET onboarding_completed_at = NULL
      WHERE onboarding_completed_at IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM envelopes WHERE envelopes.user_id = users.id)
          OR EXISTS (SELECT 1 FROM income_sources WHERE income_sources.user_id = users.id)
        )
    `);
  },
};
