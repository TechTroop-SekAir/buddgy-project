import { useTranslation } from 'react-i18next';
import { Badge, Card } from '../ui';
import { getForecastBannerState } from '../../utils/forecastStatus';
import { formatShekels } from '../../utils/money';

// `forecast.recommendation` (docs/API.md § Calendar & Forecast) is
// server-generated free text with an interpolated envelope name, not
// client-authored UI copy — there's no t() key for it, same as how
// errorMessages.js surfaces raw server strings. Known gap: it renders in
// Hebrew from mockForecastService.js today, but nothing guarantees B-07
// will localize it once it ships — worth a follow-up against B-07, not
// something to solve in A-13.
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
        <p className="text-sm text-text-secondary">{recommendation}</p>
      </div>
    </Card>
  );
}
