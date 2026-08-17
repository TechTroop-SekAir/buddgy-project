'use strict';

// Shared by every service that filters a table by a first-of-month `month`
// value against a DATEONLY column (transactions.transaction_date,
// planned_expenses.due_date). Expects an already-normalized 'YYYY-MM-DD'
// month (see envelopeService.js's normalizeMonth) — callers run that first.
/** First/last calendar day of the given month, inclusive — for a BETWEEN filter. */
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const from = month;
  const to = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10); // day 0 of next month = last day of this one
  return { from, to };
}

module.exports = { monthRange };
