import { useTranslation } from 'react-i18next';
import { Badge, Card } from '../ui';
import { getForecastBannerState } from '../../utils/forecastStatus';
import { formatShekels } from '../../utils/money';

// `forecast.recommendation` (docs/API.md § Calendar & Forecast) is a structured
// object { envelopeId, envelopeName, cutAgorot } — the server can't hand back a
// finished sentence since the client defaults to Hebrew, so this interpolates it
// via the `forecast.recommendation` i18n key, same pattern as `forecast.shortfall`.
export function ForecastBanner({ forecast, isLoading, isError }) {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-text-secondary">{t('forecast.loading')}</p>;
  }

  if (isError) {
    return <p className="text-form-error">{t('forecast.error')}</p>;
  }

  const { visible, color, projectedBalanceAgorot, recommendation } = getForecastBannerState(forecast);
  if (!visible) return null;

  return (
    <Card
      padding={0}
      className="bg-bg-surface border border-status-forecast-alert rounded-lg"
      role="alert"
    >
      <div className="px-6 py-5 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge color={color}>{t('forecast.badge')}</Badge>
          <p className="text-lg font-semibold text-status-forecast-alert">
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
