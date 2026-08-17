import api from './api';
import categoryService from './categoryService';
import plannedExpenseService from './plannedExpenseService';
import { hasMissingAmount } from '../utils/plannedExpenseStatus';

// GET /api/forecast?month= — docs/API.md § Calendar & Forecast (ticket B-07, done).
// The server only computes projectedBalanceAgorot/atRiskEnvelopes/recommendation;
// the SummaryBar totals and the missing-amount prompt (A-13) aren't server-computed,
// so this derives them client-side from the same envelope/planned-expense data the
// rest of the dashboard already loads — same posture the old mockForecastService.js
// took, just sourcing the core numbers from the real endpoint instead of reimplementing
// the formula. hasMissingAmount() stays the single source of truth shared with
// PlannedExpensesPage.jsx.
async function get(userId, month) {
  const [forecast, envelopes, plannedExpenses] = await Promise.all([
    api.get('/forecast', { params: { month } }),
    categoryService.list(userId, month),
    plannedExpenseService.list(userId, month),
  ]);

  const prefix = month.slice(0, 7); // 'YYYY-MM-01' -> 'YYYY-MM'
  const monthPlannedExpenses = plannedExpenses.filter((p) => p.due_date.startsWith(prefix));
  const missingAmountPlannedExpenses = monthPlannedExpenses
    .filter(hasMissingAmount)
    .map(({ id, title, due_date }) => ({ id, title, due_date }));

  const totalBudget = envelopes.reduce((sum, e) => sum + e.monthly_budget_agorot, 0);
  const totalPlannedExpensesAgorot = monthPlannedExpenses
    .filter((p) => p.is_confirmed)
    .reduce((sum, p) => sum + (p.amount_agorot ?? 0), 0);
  const totalEndOfMonthSpendAgorot = totalBudget - forecast.projectedBalanceAgorot;
  const totalActualSpentAgorot = totalEndOfMonthSpendAgorot - totalPlannedExpensesAgorot;

  return {
    ...forecast,
    totalActualSpentAgorot,
    totalPlannedExpensesAgorot,
    totalEndOfMonthSpendAgorot,
    missingAmountPlannedExpenses,
  };
}

const forecastService = { get };

export default forecastService;
