// Real spend tracking comes from the transactions system (server-computed
// spent_agorot, see server/services/envelopeService.js's list()).
// Returns a status *key*, not a label — translation happens at the call site
// via `t(`categoryManagement.status.${status}`)` (client/CLAUDE.md § i18n &
// RTL: pure utils don't have hook access, so they can't call `t()` themselves).
export function getCategoryStatus(category) {
  const { spent_agorot, monthly_budget_agorot } = category;
  const percentUsed = monthly_budget_agorot > 0 ? spent_agorot / monthly_budget_agorot : 0;

  // `fill` is the bright bar-only tier (Meter), distinct from `color` (text/
  // Badge, AA-contrast) — see docs/DESIGN.md § Status Colors. percentUsed is
  // an unclamped ratio; callers decide how to clamp for display.
  if (percentUsed >= 1) {
    return { color: 'status-danger', fill: 'status-danger-fill', status: 'overBudget', percentUsed };
  }
  if (percentUsed >= 0.9) {
    return { color: 'status-critical', fill: 'status-critical-fill', status: 'nearLimit', percentUsed };
  }
  if (percentUsed >= 0.75) {
    return { color: 'status-warning', fill: 'status-warning-fill', status: 'nearDepletion', percentUsed };
  }
  return { color: 'status-ok', fill: 'status-ok-fill', status: 'onTrack', percentUsed };
}

// Forward-looking signal from the forecast (docs/ARCHITECTURE.md § Forecast
// Computation), independent of the percent-used status above — a category
// can be on-track today and still at-risk once confirmed planned expenses
// land. atRiskEnvelopeIds is the forecast's atRiskEnvelopes array.
export function isCategoryAtRisk(categoryId, atRiskEnvelopeIds = []) {
  return atRiskEnvelopeIds.includes(categoryId);
}

// Highest-spend-first ordering for the dashboard's category breakdown
// (ticket A-13) — surfaces the categories eating the most budget without
// mutating the query-cached array.
export function sortCategoriesBySpent(categories) {
  return [...categories].sort((a, b) => b.spent_agorot - a.spent_agorot);
}
