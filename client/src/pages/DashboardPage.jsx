import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui';
import { CategoryFormModal } from '../components/categories/CategoryFormModal';
import { CategoryCard } from '../components/categories/CategoryCard';
import { ForecastBanner } from '../components/categories/ForecastBanner';
import { SummaryBar } from '../components/categories/SummaryBar';
import { MissingAmountPrompt } from '../components/categories/MissingAmountPrompt';
import { QuickEntryModal } from '../components/transactions/QuickEntryModal';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import categoryService from '../services/categoryService';
import transactionService from '../services/transactionService';
import forecastService from '../services/forecastService';
import plannedExpenseService from '../services/plannedExpenseService';
import { getCurrentMonth } from '../utils/month';
import { sortCategoriesBySpent } from '../utils/categoryStatus';
import { MonthNavigator } from '../components/shared/MonthNavigator';
import { PageHeader } from '../components/shared/PageHeader';

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

  const { data: categories = [], isLoading } = useQuery({
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

  // Filling in a missing amount changes a planned expense's contribution to
  // the forecast totals, so per docs/STATE.md's staleness rule this
  // invalidates forecastQueryKey the same way every other money mutation on
  // this page does.
  const missingAmountMutation = useMutation({
    mutationFn: ({ id, payload }) => plannedExpenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forecastQueryKey });
    },
  });

  const sortedCategories = sortCategoriesBySpent(categories);

  return (
    <>
      <PageHeader />
      <div className="p-8">
      <h1 className="text-2xl font-semibold text-text-primary">{t('dashboard.title')}</h1>
      <div className="flex gap-3 mt-4">
        <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
          {t('dashboard.addCategory')}
        </Button>
        <Button variant="outline" color="accent" onClick={() => setIsQuickEntryOpen(true)}>
          {t('dashboard.addTransaction')}
        </Button>
      </div>

      <div className="mt-6">
        <MonthNavigator />
      </div>

      {isLoading && <p className="text-text-secondary mt-6">{t('dashboard.loading')}</p>}

      {/* Forecast panel is always a full-width block above the envelope
          grid, stacked at every breakpoint — not a side column. */}
      {!isLoading && categories.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <ForecastBanner forecast={forecast} isLoading={isForecastLoading} isError={isForecastError} />
          <SummaryBar
            categories={categories}
            forecast={forecast}
            isForecastLoading={isForecastLoading}
            isForecastError={isForecastError}
          />
          <MissingAmountPrompt
            plannedExpenses={forecast?.missingAmountPlannedExpenses}
            onSubmit={(id, payload) => missingAmountMutation.mutateAsync({ id, payload })}
          />
        </div>
      )}

      {!isLoading && categories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
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
      )}

      {!isLoading && categories.length === 0 && isCurrentMonth && (
        <div className="flex flex-col items-center justify-center text-center mt-16 gap-4">
          <p className="text-text-secondary">{t('dashboard.empty')}</p>
          <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
            {t('dashboard.addFirstCategory')}
          </Button>
        </div>
      )}

      {!isLoading && categories.length === 0 && !isCurrentMonth && (
        <div className="flex flex-col items-center justify-center text-center mt-16 gap-4">
          <p className="text-text-secondary">{t('dashboard.emptyMonth')}</p>
        </div>
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
    </>
  );
}
