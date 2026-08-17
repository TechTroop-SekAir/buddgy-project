// Single source of truth for what counts as a "missing amount" planned
// expense (docs/ARCHITECTURE.md § Forecast Computation's missing-amount
// handling) — used by mockForecastService.js to build the actionable-prompt
// list and by PlannedExpensesPage.jsx to guard the amount cell, so the two
// surfaces can't drift on the definition.
export function hasMissingAmount(plannedExpense) {
  return plannedExpense.amount_agorot == null || plannedExpense.amount_agorot === 0;
}
