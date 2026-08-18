import { useTranslation } from 'react-i18next';
import { Card, Icon, Meter, Skeleton } from '../ui';
import { formatShekels, formatShekelsRounded } from '../../utils/money';

// Fixed-geometry tile — width/height never depend on load state, which is
// what fixes the layout-shift bug the old flex-wrap row had (see
// docs/DASHBOARD-REDESIGN.md Step 8).
function StatTile({ icon, accent, label, value, isLoading }) {
  return (
    <Card padding={0} className="flex items-center gap-4 rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${accent.chip}`}>
        <Icon name={icon} size="md" className={accent.icon} />
      </span>
      <div>
        <p className="text-xs font-medium text-text-muted">{label}</p>
        {isLoading ? (
          <Skeleton height={24} width={96} mt={4} />
        ) : (
          <p className="mt-0.5 font-mono text-xl font-semibold text-text-primary">{value}</p>
        )}
      </div>
    </Card>
  );
}

// Budget/Spent come straight from `categories` (available as soon as the
// category list loads); the commitment-based totals below come from the
// forecast query, which loads separately and can lag behind or fail
// independently — see docs/ARCHITECTURE.md § Forecast Computation.
export function SummaryBar({ categories = [], forecast, isForecastLoading, isForecastError, monthLabel }) {
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
  const overallPercent = totals.budget > 0 ? (totals.spent / totals.budget) * 100 : 0;
  const overallColor = overallPercent >= 100 ? 'status-danger' : overallPercent >= 90 ? 'status-critical' : overallPercent >= 75 ? 'status-warning' : 'status-ok';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon="trendingUp"
          accent={{ chip: 'bg-cat-1-tint', icon: 'text-cat-1' }}
          label={t('categoryManagement.totalBudget')}
          value={formatShekelsRounded(totals.budget)}
        />
        <StatTile
          icon="trendingDown"
          accent={{ chip: 'bg-cat-2-tint', icon: 'text-cat-2' }}
          label={t('categoryManagement.totalSpent')}
          value={formatShekelsRounded(totals.spent)}
        />
        <StatTile
          icon="piggyBank"
          accent={{ chip: 'bg-cat-4-tint', icon: 'text-cat-4' }}
          label={t('categoryManagement.safeToSpend')}
          value={formatShekelsRounded(remainingTotalBudget)}
          isLoading={isForecastLoading}
        />
      </div>

      {isForecastError && (
        <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm" role="alert">
          <p className="text-sm text-form-error">{t('forecast.error')}</p>
        </Card>
      )}

      {!isForecastError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm">
            <p className="text-xs font-medium text-text-muted">{t('categoryManagement.totalPlannedExpenses')}</p>
            {isForecastLoading ? (
              <Skeleton height={24} width={96} mt={4} />
            ) : (
              <p className="mt-0.5 font-mono text-xl font-semibold text-text-primary">
                {formatShekelsRounded(forecast?.totalPlannedExpensesAgorot ?? 0)}
              </p>
            )}
          </Card>
          <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm">
            <p className="text-xs font-medium text-text-muted">{t('categoryManagement.totalEndOfMonthSpend')}</p>
            {isForecastLoading ? (
              <Skeleton height={24} width={96} mt={4} />
            ) : (
              <p className="mt-0.5 font-mono text-xl font-semibold text-text-primary">
                {formatShekelsRounded(forecast?.totalEndOfMonthSpendAgorot ?? 0)}
              </p>
            )}
          </Card>
        </div>
      )}

      <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface px-6 py-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">
            {t('categoryManagement.overallSpending', { month: monthLabel })}
          </span>
          <span
            className={`font-mono text-sm font-semibold ${
              isDeficit ? 'text-status-forecast-alert' : 'text-text-primary'
            }`}
          >
            {t('categoryManagement.percentUsed', { percent: Math.round(overallPercent) })}
          </span>
        </div>
        <Meter
          percent={overallPercent}
          color={overallColor}
          size="lg"
          label={t('categoryManagement.overallSpending', { month: monthLabel })}
        />
        <p className="mt-2 text-xs text-text-muted">
          {isDeficit
            ? t('categoryManagement.projectedDeficitLabel') + ': ' + formatShekels(Math.abs(remainingTotalBudget))
            : t('categoryManagement.remainingOf', {
                remaining: formatShekels(remainingTotalBudget),
                budget: formatShekels(totals.budget),
              })}
        </p>
      </Card>
    </div>
  );
}
