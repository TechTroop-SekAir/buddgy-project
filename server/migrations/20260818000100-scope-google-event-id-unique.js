'use strict';

// google_event_id was globally UNIQUE, but Google assigns the same event id
// to every attendee of a shared event — so two users syncing the same event
// collided, and the second sync silently overwrote the first user's row
// (see server/services/calendarSyncService.js). Scope the uniqueness to
// (user_id, google_event_id) instead: each user still gets idempotent
// re-syncs, but users no longer share a row. docs/DATABASE.md § Idempotency.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeConstraint('planned_expenses', 'planned_expenses_google_event_id_key');
    await queryInterface.addConstraint('planned_expenses', {
      fields: ['user_id', 'google_event_id'],
      type: 'unique',
      name: 'planned_expenses_user_id_google_event_id_key',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('planned_expenses', 'planned_expenses_user_id_google_event_id_key');
    await queryInterface.addConstraint('planned_expenses', {
      fields: ['google_event_id'],
      type: 'unique',
      name: 'planned_expenses_google_event_id_key',
    });
  },
};
