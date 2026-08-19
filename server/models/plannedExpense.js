'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlannedExpense = sequelize.define(
    'PlannedExpense',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      envelope_id: { type: DataTypes.INTEGER },
      title: { type: DataTypes.STRING(160) },
      amount_agorot: { type: DataTypes.INTEGER },
      due_date: { type: DataTypes.DATEONLY },
      // UNIQUE per (user_id, google_event_id) — migration 20260818000100 —
      // re-syncs UPSERT on that pair, never blind-insert. Not unique alone:
      // Google reuses one event id across every attendee of a shared event.
      google_event_id: { type: DataTypes.STRING(128) },
      is_confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // 'calendar' | 'manual'
      source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'calendar' },
      // 'likely' | 'unlikely' | 'unknown' — set by calendarSyncService's
      // classifier. See docs/features/UPCOMING-EVENTS.md.
      cost_likelihood: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'unknown' },
      // User said "this won't cost money" — sticky across re-syncs.
      is_dismissed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // The transaction created when this row was confirmed — see
      // plannedExpenseService.js's update(). Null until confirmed.
      transaction_id: { type: DataTypes.INTEGER },
    },
    {
      tableName: 'planned_expenses',
      underscored: true,
      timestamps: false,
    }
  );

  return PlannedExpense;
};
