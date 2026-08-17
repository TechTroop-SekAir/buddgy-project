import api from './api';

// GET /api/forecast?month= — docs/API.md § Calendar & Forecast (ticket B-07).
// The server computes the full contract (projectedBalanceAgorot, atRiskEnvelopes,
// recommendation, totalActualSpentAgorot, totalPlannedExpensesAgorot,
// totalEndOfMonthSpendAgorot, missingAmountPlannedExpenses) in one place
// (server/services/forecastService.js) — this used to re-derive the total*
// fields client-side from separate envelope/planned-expense fetches, which
// let the client's numbers silently drift from the server's whenever the two
// computations disagreed (e.g. on confirmed-vs-unconfirmed planned expenses).
// Passing the response straight through makes that class of bug structurally
// impossible: there is exactly one implementation of the math.
async function get(userId, month) {
  return api.get('/forecast', { params: { month } });
}

const forecastService = { get };

export default forecastService;
