import { useTranslation } from 'react-i18next';
import { Card, Icon, Meter, Skeleton } from '../ui';
import { formatShekels, formatShekelsRounded } from '../../utils/money';

// Fixed-geometry tile — width/height never depend on load state, which is
// what fixes the layout-shift bug the old flex-wrap row had (see
// docs/DASHBOARD-REDESIGN.md Step 8).
function StatTile({ icon, accent, label, value, subValue, isLoading }) {
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
          <>
            <p className="num-tabular mt-0.5 font-mono text-xl font-semibold text-text-primary">{value}</p>
            {subValue && <p className="num-tabular font-mono text-xs text-text-muted">{subValue}</p>}
          </>
        )}
      </div>
    </Card>
  );
}

// Budget/Spent come straight from `categories` (available as soon as the
// category list loads); the commitment-based totals below come from the
// forecast query, which loads separately and can lag behind or fail
// independently — see docs/ARCHITECTURE.md § Forecast Computation.
export function SummaryBar({
  categories = [],
  forecast,
  isForecastLoading,
  isForecastError,
  income,
  isIncomeLoading,
  monthLabel,
}) {
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

  const incomeTotalAgorot = income?.total_agorot ?? 0;
  const plannedTotalAgorot = forecast?.totalEndOfMonthSpendAgorot ?? 0;
  const plannedSavingsBalanceAgorot = incomeTotalAgorot - plannedTotalAgorot;
  // "תכנון הוצאות / צפוי" previously showed actual+planned spend with no
  // budget figure to compare it against — see docs/features/HOMEPAGE-FIXES.md
  // § 2.2. forecast.totalBudgetAgorot falls back to totals.budget (derived
  // from `categories`) so this still renders before the forecast query loads.
  const totalBudgetAgorot = forecast?.totalBudgetAgorot ?? totals.budget;

  return (
    <div className="flex flex-col gap-4">
      {isForecastError ? (
        <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface p-5 shadow-sm" role="alert">
          <p className="text-sm text-form-error">{t('forecast.error')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon="wallet"
            accent={{ chip: 'bg-cat-1-tint', icon: 'text-cat-1' }}
            label={t('summaryBar.income')}
            value={formatShekelsRounded(incomeTotalAgorot)}
            isLoading={isIncomeLoading}
          />
          <StatTile
            icon="trendingDown"
            accent={{ chip: 'bg-cat-2-tint', icon: 'text-cat-2' }}
            label={t('summaryBar.actualExpenses')}
            value={formatShekelsRounded(forecast?.totalActualSpentAgorot ?? totals.spent)}
            isLoading={isForecastLoading}
          />
          <StatTile
            icon="calendarDays"
            accent={{ chip: 'bg-cat-5-tint', icon: 'text-cat-5' }}
            label={t('summaryBar.plannedExpenses')}
            value={formatShekelsRounded(plannedTotalAgorot)}
            subValue={t('summaryBar.ofBudget', { budget: formatShekelsRounded(totalBudgetAgorot) })}
            isLoading={isForecastLoading}
          />
          <StatTile
            icon="piggyBank"
            accent={{ chip: 'bg-cat-4-tint', icon: 'text-cat-4' }}
            label={t('summaryBar.plannedSavingsBalance')}
            value={formatShekelsRounded(plannedSavingsBalanceAgorot)}
            isLoading={isForecastLoading || isIncomeLoading}
          />
        </div>
      )}

      <Card padding={0} className="rounded-lg border border-border-card bg-bg-surface px-6 py-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">
            {t('categoryManagement.overallSpending', { month: monthLabel })}
          </span>
          <span
            className={`num-tabular font-mono text-sm font-semibold ${
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
