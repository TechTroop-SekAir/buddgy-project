// Mock-only status derivation: real spend tracking arrives with the
// transactions ticket — see mockEnvelopeService.js for the spent_agorot deviation.
export function getEnvelopeStatus(envelope, t) {
  const { spent_agorot, monthly_budget_agorot } = envelope;
  const percentUsed = monthly_budget_agorot > 0 ? spent_agorot / monthly_budget_agorot : 0;

  if (percentUsed >= 1) {
    return { color: 'status-danger', label: t('envelopes.status.overBudget'), percentUsed };
  }
  if (percentUsed >= 0.75) {
    return { color: 'status-warning', label: t('envelopes.status.nearDepletion'), percentUsed };
  }
  return { color: 'status-ok', label: t('envelopes.status.onTrack'), percentUsed };
}
