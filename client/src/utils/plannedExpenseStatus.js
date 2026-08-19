// Single source of truth for what counts as a "missing amount" planned
// expense (docs/ARCHITECTURE.md § Forecast Computation's missing-amount
// handling) — used by forecastService.js to build the actionable-prompt
// list and by PlannedExpensesPage.jsx to guard the amount cell, so the two
// surfaces can't drift on the definition.
export function hasMissingAmount(plannedExpense) {
  return plannedExpense.amount_agorot == null || plannedExpense.amount_agorot === 0;
}

// A calendar-synced event Claude judged likely to cost money and the user
// hasn't yet confirmed or dismissed — the definition of "Upcoming Events"
// (docs/features/UPCOMING-EVENTS.md), shared by UpcomingEventsCard.jsx and
// PlannedExpensesPage.jsx so the two can't drift on it.
export function isUpcomingEvent(plannedExpense) {
  return (
    plannedExpense.source === 'calendar' &&
    plannedExpense.cost_likelihood === 'likely' &&
    !plannedExpense.is_confirmed &&
    !plannedExpense.is_dismissed
  );
}

// Same event, but the user already said "this won't cost money" — the
// dismissed list the "show dismissed" toggle surfaces for undo.
export function isDismissedUpcomingEvent(plannedExpense) {
  return (
    plannedExpense.source === 'calendar' &&
    plannedExpense.cost_likelihood === 'likely' &&
    plannedExpense.is_dismissed
  );
}
