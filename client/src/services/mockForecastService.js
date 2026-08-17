import categoryService from './categoryService';
import transactionService from './transactionService';
import plannedExpenseService from './plannedExpenseService';
import { formatShekels } from '../utils/money';
import { hasMissingAmount } from '../utils/plannedExpenseStatus';

// GET /api/forecast?month= is documented in docs/API.md § Calendar & Forecast
// but doesn't exist server-side yet (B-07, see docs/PLAN.md ticket list).
// This reimplements the formula from docs/ARCHITECTURE.md § Forecast
// Computation against the same real envelope/transaction/planned-expense
// data the rest of the dashboard already uses, so numbers stay realistic and
// the swap to the real endpoint later is a pure data-source change — same
// posture plannedExpenseService.js already took toward this exact gap.

function monthPrefix(month) {
  return month.slice(0, 7); // 'YYYY-MM-01' -> 'YYYY-MM'
}

function sumAgorot(items) {
  return items.reduce((sum, item) => sum + item.amount_agorot, 0);
}

function groupSumByEnvelope(plannedExpenses) {
  return plannedExpenses.reduce((acc, p) => {
    if (p.envelope_id == null) return acc;
    acc[p.envelope_id] = (acc[p.envelope_id] ?? 0) + p.amount_agorot;
    return acc;
  }, {});
}

function remainingForEnvelope(envelope, confirmedPlannedByEnvelope) {
  return (
    envelope.monthly_budget_agorot -
    (envelope.spent_agorot ?? 0) -
    (confirmedPlannedByEnvelope[envelope.id] ?? 0)
  );
}

// Ranks envelopes by remaining headroom and suggests trimming from whichever
// still has the most slack, per ARCHITECTURE.md's "rank by headroom" rule —
// cutting from the envelope that's already tightest would be bad advice.
function buildRecommendation(shortfallAgorot, envelopes, confirmedPlannedByEnvelope) {
  const ranked = [...envelopes].sort(
    (a, b) =>
      remainingForEnvelope(b, confirmedPlannedByEnvelope) - remainingForEnvelope(a, confirmedPlannedByEnvelope)
  );
  const target = ranked[0];
  const headroom = remainingForEnvelope(target, confirmedPlannedByEnvelope);
  const suggestedCutAgorot = Math.max(0, Math.min(shortfallAgorot, headroom));
  return `כדאי לצמצם ${formatShekels(suggestedCutAgorot)} בקטגוריית "${target.name}" כדי לאזן את התחזית לחודש`;
}

async function get(userId, month) {
  const [envelopes, transactions, plannedExpenses] = await Promise.all([
    categoryService.list(userId, month),
    transactionService.list(userId, month),
    plannedExpenseService.list(userId, month),
  ]);

  const prefix = monthPrefix(month);
  const monthPlannedExpenses = plannedExpenses.filter((p) => p.due_date.startsWith(prefix));
  // Reachable even though calendar sync itself never persists a null amount
  // today (server/services/calendarSyncService.js skips unparsed events) —
  // PATCH /planned-expenses/:id and the DB schema both still allow a null or
  // 0 amount_agorot, so this is a real edge case, not a hypothetical one.
  const missingAmountPlannedExpenses = monthPlannedExpenses
    .filter(hasMissingAmount)
    .map(({ id, title, due_date }) => ({ id, title, due_date }));

  if (envelopes.length === 0) {
    return {
      projectedBalanceAgorot: 0,
      atRiskEnvelopes: [],
      recommendation: null,
      totalActualSpentAgorot: 0,
      totalPlannedExpensesAgorot: 0,
      totalEndOfMonthSpendAgorot: 0,
      missingAmountPlannedExpenses,
    };
  }

  const confirmedPlanned = monthPlannedExpenses.filter((p) => p.is_confirmed);
  const confirmedPlannedByEnvelope = groupSumByEnvelope(confirmedPlanned);

  const totalBudget = envelopes.reduce((sum, e) => sum + e.monthly_budget_agorot, 0);
  const totalSpent = sumAgorot(transactions);
  const totalConfirmedPlanned = sumAgorot(confirmedPlanned);
  const totalEndOfMonthSpendAgorot = totalSpent + totalConfirmedPlanned;
  const projectedBalanceAgorot = totalBudget - totalEndOfMonthSpendAgorot;

  const atRiskEnvelopes = envelopes
    .filter((e) => remainingForEnvelope(e, confirmedPlannedByEnvelope) < 0)
    .map((e) => e.id);

  const recommendation =
    projectedBalanceAgorot < 0
      ? buildRecommendation(Math.abs(projectedBalanceAgorot), envelopes, confirmedPlannedByEnvelope)
      : null;

  return {
    projectedBalanceAgorot,
    atRiskEnvelopes,
    recommendation,
    totalActualSpentAgorot: totalSpent,
    totalPlannedExpensesAgorot: totalConfirmedPlanned,
    totalEndOfMonthSpendAgorot,
    missingAmountPlannedExpenses,
  };
}

const mockForecastService = { get };
export default mockForecastService;
