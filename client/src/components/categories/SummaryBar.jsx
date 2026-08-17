import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { formatShekels } from '../../utils/money';

// Budget/Spent come straight from `categories` (available as soon as the
// category list loads); the commitment-based totals below come from the
// forecast query, which loads separately and can lag behind or fail
// independently — see docs/ARCHITECTURE.md § Forecast Computation.
export function SummaryBar({ categories = [], forecast, isForecastLoading, isForecastError }) {
  const { t } = useTranslation();
  const totals = categories.reduce(
    (acc, category) => ({
      budget: acc.budget + category.monthly_budget_agorot,
      spent: acc.spent + category.spent_agorot,
    }),
    { budget: 0, spent: 0 }
  );
  const remainingTotalBudget = forecast?.projectedBalanceAgorot ?? totals.budget - totals.spent;
  const isDeficit = Boolean(forecast) && remainingTotalBudget < 0;

  return (
    <Card padding={0} className="bg-bg-surface border border-border-card rounded-lg">
      <div className="px-6 py-5 flex flex-wrap gap-8">
        <div>
          <p className="text-sm text-text-secondary">{t('categoryManagement.totalBudget')}</p>
          <p className="text-xl font-semibold text-text-primary">{formatShekels(totals.budget)}</p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">{t('categoryManagement.totalSpent')}</p>
          <p className="text-xl font-semibold text-text-primary">{formatShekels(totals.spent)}</p>
        </div>

        {isForecastLoading && <p className="text-sm text-text-secondary self-center">{t('forecast.loading')}</p>}
        {isForecastError && (
          <p className="text-sm text-form-error self-center" role="alert">
            {t('forecast.error')}
          </p>
        )}
        {!isForecastLoading && !isForecastError && forecast && (
          <>
            <div>
              <p className="text-sm text-text-secondary">{t('categoryManagement.totalPlannedExpenses')}</p>
              <p className="text-xl font-semibold text-text-primary">
                {formatShekels(forecast.totalPlannedExpensesAgorot)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">{t('categoryManagement.totalEndOfMonthSpend')}</p>
              <p className="text-xl font-semibold text-text-primary">
                {formatShekels(forecast.totalEndOfMonthSpendAgorot)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">
                {isDeficit ? t('categoryManagement.projectedDeficitLabel') : t('categoryManagement.remainingTotalBudget')}
              </p>
              <p
                className={`text-xl font-semibold ${isDeficit ? 'text-status-forecast-alert' : 'text-text-primary'}`}
              >
                {isDeficit ? formatShekels(Math.abs(remainingTotalBudget)) : formatShekels(remainingTotalBudget)}
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
