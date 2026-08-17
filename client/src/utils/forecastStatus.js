// Pure, hook-free forecast status logic — mirrors categoryStatus.js's
// pattern of returning a status shape rather than a label (pure utils can't
// call t(), see client/CLAUDE.md § i18n & RTL).
//
// Per docs/ARCHITECTURE.md § Forecast Computation, `recommendation` is only
// generated when the overall projection is negative, so a non-null
// recommendation is already the correct signal for "show the alert banner" —
// there's no separate healthy/neutral banner state to design for.
export function getForecastBannerState(forecast) {
  if (!forecast || !forecast.recommendation) {
    return { visible: false };
  }
  return {
    visible: true,
    color: 'status-forecast-alert',
    projectedBalanceAgorot: forecast.projectedBalanceAgorot,
    recommendation: forecast.recommendation,
  };
}
