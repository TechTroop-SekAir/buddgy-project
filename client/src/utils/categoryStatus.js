// Real spend tracking comes from the transactions system (server-computed
// spent_agorot, see server/services/envelopeService.js's list()).
// Returns a status *key*, not a label — translation happens at the call site
// via `t(`categoryManagement.status.${status}`)` (client/CLAUDE.md § i18n &
// RTL: pure utils don't have hook access, so they can't call `t()` themselves).
export function getCategoryStatus(category) {
  const { spent_agorot, monthly_budget_agorot } = category;
  const percentUsed = monthly_budget_agorot > 0 ? spent_agorot / monthly_budget_agorot : 0;

  if (percentUsed >= 1) {
    return { color: 'status-danger', status: 'overBudget', percentUsed };
  }
  if (percentUsed >= 0.75) {
    return { color: 'status-warning', status: 'nearDepletion', percentUsed };
  }
  return { color: 'status-ok', status: 'onTrack', percentUsed };
}
