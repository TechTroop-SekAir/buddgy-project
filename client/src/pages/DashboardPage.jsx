import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, Icon, Skeleton } from '../components/ui';
import { CategoryFormModal } from '../components/categories/CategoryFormModal';
import { CategoryCard } from '../components/categories/CategoryCard';
import { ForecastBanner } from '../components/categories/ForecastBanner';
import { SummaryBar } from '../components/categories/SummaryBar';
import { UpcomingEventsCard } from '../components/plannedExpenses/UpcomingEventsCard';
import { QuickEntryModal } from '../components/transactions/QuickEntryModal';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import categoryService from '../services/categoryService';
import transactionService from '../services/transactionService';
import forecastService from '../services/forecastService';
import plannedExpenseService from '../services/plannedExpenseService';
import incomeService from '../services/incomeService';
import { getCurrentMonth } from '../utils/month';
import { getDaysRemainingInMonth, getMonthLabel } from '../utils/date';
import { sortCategoriesBySpent } from '../utils/categoryStatus';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const { month } = useMonth();
  const isCurrentMonth = month === getCurrentMonth();
  const queryKey = ['categories', user.id, month];

  const forecastQueryKey = ['forecast', user.id, month];

  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => categoryService.list(user.id, month),
  });

  const {
    data: forecast,
    isLoading: isForecastLoading,
    isError: isForecastError,
  } = useQuery({
    queryKey: forecastQueryKey,
    queryFn: () => forecastService.get(user.id, month),
    enabled: categories.length > 0,
  });

  // includeDismissed so UpcomingEventsCard's "show dismissed" toggle has
  // something to undo — same reasoning as PlannedExpensesPage.jsx.
  const plannedExpensesQueryKey = ['planned-expenses', user.id, month];

  const {
    data: allPlannedExpenses = [],
    isLoading: isPlannedExpensesLoading,
    isError: isPlannedExpensesError,
  } = useQuery({
    queryKey: plannedExpensesQueryKey,
    queryFn: () => plannedExpenseService.list(user.id, month, { includeDismissed: true }),
  });

  const incomeQueryKey = ['income-sources', user.id, month];

  const {
    data: income,
    isLoading: isIncomeLoading,
    isError: isIncomeError,
  } = useQuery({
    queryKey: incomeQueryKey,
    queryFn: () => incomeService.list(user.id, month),
  });

  // Every mutation below changes money-relevant data, so per docs/STATE.md's
  // staleness rule, each one also invalidates the forecast for this month —
  // it's easy to update the category list and forget the forecast is stale.
  const createMutation = useMutation({
    mutationFn: (payload) => categoryService.create(user.id, { ...payload, month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => categoryService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => categoryService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });

  const quickEntryMutation = useMutation({
    mutationFn: (payload) => transactionService.create(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });

  // UpcomingEventsCard's four actions (dismiss / undo-dismiss / spend / save
  // a missing amount) are all just PATCHes to a planned expense — same
  // invalidation set PlannedExpensesPage.jsx and SettingsPage.jsx use for
  // the same card, since every one of them can change forecast totals and,
  // via envelope assignment or confirmation, the envelope cards above.
  const dismissMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.update(id, { is_dismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });
  const undoDismissMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.update(id, { is_dismissed: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });
  const spendMutation = useMutation({
    mutationFn: ({ id, payload }) => plannedExpenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });
  const saveAmountMutation = useMutation({
    mutationFn: ({ id, payload }) => plannedExpenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });

  const sortedCategories = sortCategoriesBySpent(categories);
  const categoryOptions = categories.map((category) => ({ value: String(category.id), label: category.name }));
  const monthLabel = getMonthLabel(month);
  const daysRemaining = getDaysRemainingInMonth(month);
  const hasIncome = income?.rows?.length > 0;
  const hasSummaryData = categories.length > 0 || hasIncome;

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{t('dashboard.title')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {daysRemaining != null ? t('dashboard.monthMeta', { month: monthLabel, count: daysRemaining }) : monthLabel}
          </p>
        </div>
        <Button variant="outline" color="accent" onClick={() => setIsQuickEntryOpen(true)}>
          {t('dashboard.addTransaction')}
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4" aria-label={t('dashboard.loading')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton height={76} radius="lg" />
            <Skeleton height={76} radius="lg" />
            <Skeleton height={76} radius="lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton height={180} radius="lg" />
            <Skeleton height={180} radius="lg" />
            <Skeleton height={180} radius="lg" />
          </div>
        </div>
      )}

      {!isLoading && isError && <Alert className="mt-6">{t('dashboard.error')}</Alert>}

      {/* Forecast panel is always a full-width block above the envelope
          grid, stacked at every breakpoint — not a side column. SummaryBar
          alone can render before any categories exist (e.g. right after
          onboarding with income entered but no categories picked) since it
          already falls back gracefully when `forecast` is undefined; the
          forecast-dependent banner/card stay gated on real category data. */}
      {!isLoading && !isError && hasSummaryData && (
        <div className="flex flex-col gap-4">
          {categories.length > 0 && (
            <ForecastBanner forecast={forecast} isLoading={isForecastLoading} isError={isForecastError} />
          )}
          <SummaryBar
            categories={categories}
            forecast={forecast}
            isForecastLoading={isForecastLoading}
            isForecastError={isForecastError}
            income={income}
            isIncomeLoading={isIncomeLoading}
            isIncomeError={isIncomeError}
            monthLabel={monthLabel}
          />
          {categories.length > 0 && !isPlannedExpensesLoading && !isPlannedExpensesError && (
            <UpcomingEventsCard
              plannedExpenses={allPlannedExpenses}
              missingAmountPlannedExpenses={forecast?.missingAmountPlannedExpenses}
              categoryOptions={categoryOptions}
              onDismiss={(id) => dismissMutation.mutateAsync(id)}
              onUndoDismiss={(id) => undoDismissMutation.mutateAsync(id)}
              onSpend={(id, payload) => spendMutation.mutateAsync({ id, payload })}
              onSaveAmount={(id, payload) => saveAmountMutation.mutateAsync({ id, payload })}
            />
          )}
          {categories.length > 0 && isPlannedExpensesError && (
            <Alert>{t('plannedExpenses.error')}</Alert>
          )}
        </div>
      )}

      {!isLoading && !isError && categories.length > 0 && (
        <>
          <div className="mb-4 mt-7 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-strong">{t('categoryManagement.heading')}</h2>
            <Button variant="subtle" color="accent" size="sm" onClick={() => setIsAddOpen(true)}>
              <Icon name="plus" size="sm" className="me-1" />
              {t('dashboard.addCategory')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onDelete={(id) => deleteMutation.mutateAsync(id)}
                onEdit={(id, payload) => updateMutation.mutateAsync({ id, payload })}
                atRiskEnvelopeIds={forecast?.atRiskEnvelopes ?? []}
              />
            ))}
          </div>
        </>
      )}

      {!isLoading && !isError && categories.length === 0 && isCurrentMonth && (
        <EmptyState
          className="mt-16"
          message={t('dashboard.empty')}
          action={
            <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
              {t('dashboard.addFirstCategory')}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && categories.length === 0 && !isCurrentMonth && (
        <EmptyState className="mt-16" message={t('dashboard.emptyMonth')} />
      )}

      <CategoryFormModal
        opened={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={(payload) => createMutation.mutateAsync(payload)}
      />

      <QuickEntryModal
        opened={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onConfirm={(payload) => quickEntryMutation.mutateAsync(payload)}
      />
    </div>
  );
}
