import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon } from '../ui';
import { getForecastBannerState } from '../../utils/forecastStatus';
import { formatShekels } from '../../utils/money';

// `forecast.recommendation` (docs/API.md § Calendar & Forecast) is a structured
// object { envelopeId, envelopeName, cutAgorot } — the server can't hand back a
// finished sentence since the client defaults to Hebrew, so this interpolates it
// via the `forecast.recommendation` i18n key, same pattern as `forecast.shortfall`.
export function ForecastBanner({ forecast, isLoading, isError }) {
  const { t } = useTranslation();

  // SummaryBar already surfaces the forecast's loading affordance (its
  // stat-tile skeletons) — a second spinner here would read as a second,
  // unrelated failure. See docs/DASHBOARD-REDESIGN.md Step 9.
  if (isLoading) return null;

  if (isError) {
    return (
      <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm" role="alert">
        <p className="text-sm text-form-error">{t('forecast.error')}</p>
      </Card>
    );
  }

  const { visible, color, projectedBalanceAgorot, recommendation } = getForecastBannerState(forecast);
  if (!visible) return null;

  return (
    <Card
      padding={0}
      className="flex items-start gap-3 rounded-lg border border-status-forecast-alert bg-status-danger-tint p-5 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <Icon name="alertTriangle" size="md" className="mt-0.5 shrink-0 text-status-forecast-alert" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge color={color}>{t('forecast.badge')}</Badge>
          <p className="text-base font-semibold text-status-forecast-alert">
            {t('forecast.shortfall', { amount: formatShekels(Math.abs(projectedBalanceAgorot)) })}
          </p>
        </div>
        <p className="text-sm text-text-secondary">
          {t('forecast.recommendation', {
            amount: formatShekels(recommendation.cutAgorot),
            envelope: recommendation.envelopeName,
          })}
        </p>
      </div>
    </Card>
  );
}
