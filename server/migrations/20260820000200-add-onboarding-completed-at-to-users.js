'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Null = onboarding wizard hasn't been completed yet (client/src/components/
    // onboarding/OnboardingWizardModal.jsx). A timestamp, not a boolean, so the
    // exact completion date is available if ever needed for analytics.
    await queryInterface.addColumn('users', 'onboarding_completed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'onboarding_completed_at');
  },
};
