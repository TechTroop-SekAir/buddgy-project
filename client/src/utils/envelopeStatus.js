// Mock-only status derivation: real spend tracking arrives with the
// transactions ticket — see mockEnvelopeService.js for the spent_agorot deviation.
export function getEnvelopeStatus(envelope) {
  const { spent_agorot, monthly_budget_agorot } = envelope;
  const percentUsed = monthly_budget_agorot > 0 ? spent_agorot / monthly_budget_agorot : 0;

  if (percentUsed >= 1) {
    return { color: 'status-danger', label: 'Over budget', percentUsed };
  }
  if (percentUsed >= 0.75) {
    return { color: 'status-warning', label: 'Near depletion', percentUsed };
  }
  return { color: 'status-ok', label: 'On track', percentUsed };
}
