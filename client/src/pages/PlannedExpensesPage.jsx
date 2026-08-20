import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, Skeleton, Table } from '../components/ui';
import { PlannedExpenseFormModal } from '../components/plannedExpenses/PlannedExpenseFormModal';
import { PlannedExpenseRow } from '../components/plannedExpenses/PlannedExpenseRow';
import { UpcomingEventsCard } from '../components/plannedExpenses/UpcomingEventsCard';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import plannedExpenseService from '../services/plannedExpenseService';
import categoryService from '../services/categoryService';
import { getCurrentMonth } from '../utils/month';

export function PlannedExpensesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { month } = useMonth();
  const isCurrentMonth = month === getCurrentMonth();
  const queryKey = ['planned-expenses', user.id, month];
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Fetched with includeDismissed so UpcomingEventsCard's "show dismissed"
  // toggle has something to undo (docs/features/UPCOMING-EVENTS.md) — the
  // main table below filters dismissed rows back out itself.
  const {
    data: allPlannedExpenses = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => plannedExpenseService.list(user.id, month, { includeDismissed: true }),
  });
  const plannedExpenses = allPlannedExpenses.filter((p) => !p.is_dismissed);

  const { data: categories = [], isError: isCategoriesError } = useQuery({
    queryKey: ['categories', user.id, month],
    queryFn: () => categoryService.list(user.id, month),
  });
  const categoryOptions = categories.map((category) => ({ value: String(category.id), label: category.name }));

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => plannedExpenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Envelope assignment and is_confirmed both feed directly into the
      // forecast formula (docs/ARCHITECTURE.md § Forecast Computation), so
      // this must invalidate forecast too (docs/STATE.md's staleness rule).
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
      // Also invalidate the dashboard's envelope list — reassigning or
      // confirming a planned expense changes what that envelope's card
      // should show, so its cache (DashboardPage.jsx's `['categories', ...]`
      // query) must be treated as stale here too, same staleness rule.
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      // Confirming now atomically creates a real transaction
      // (plannedExpenseService.js's update()), so the transactions list
      // (TransactionsPage.jsx, DashboardPage.jsx's quick-entry mutation)
      // must be treated as stale here too.
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => plannedExpenseService.create(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  // A recurring submission is N independent creates (one row per month,
  // same non-atomic Promise.all pattern DashboardPage.jsx's onboardingMutation
  // uses for creating several envelopes from one user action) — not a single
  // bulk-create endpoint, since each row is fully independent afterward.
  const createPlannedExpenses = (payloads) => Promise.all(payloads.map((payload) => createMutation.mutateAsync(payload)));

  const deleteMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  // Dismiss/undo and the spend prompt are all just PATCHes — same
  // invalidation rule as the mutations above (docs/STATE.md's staleness rule).
  const dismissMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.update(id, { is_dismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });
  const undoDismissMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.update(id, { is_dismissed: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });
  const spendMutation = useMutation({
    mutationFn: ({ id, payload }) => plannedExpenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{t('plannedExpenses.title')}</h1>
        <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
          {t('plannedExpenses.addButton')}
        </Button>
      </div>

      <PlannedExpenseFormModal
        opened={isAddOpen}
        categoryOptions={categoryOptions}
        onClose={() => setIsAddOpen(false)}
        onSubmit={createPlannedExpenses}
      />

      {isCategoriesError && <Alert className="mt-4">{t('plannedExpenses.categoriesError')}</Alert>}

      {isLoading && (
        <div className="mt-6 flex flex-col gap-2" aria-label={t('plannedExpenses.loading')}>
          <Skeleton height={40} radius="sm" />
          <Skeleton height={40} radius="sm" />
          <Skeleton height={40} radius="sm" />
        </div>
      )}

      {!isLoading && isError && <Alert className="mt-6">{t('plannedExpenses.error')}</Alert>}

      {!isLoading && !isError && (
        <UpcomingEventsCard
          className="mt-6"
          plannedExpenses={allPlannedExpenses}
          categoryOptions={categoryOptions}
          onDismiss={(id) => dismissMutation.mutateAsync(id)}
          onUndoDismiss={(id) => undoDismissMutation.mutateAsync(id)}
          onSpend={(id, payload) => spendMutation.mutateAsync({ id, payload })}
        />
      )}

      {/* allPlannedExpenses, not plannedExpenses: if every row is dismissed,
          the user still has calendar data — the "connect and sync" empty
          state below would be misleading. */}
      {!isLoading && !isError && allPlannedExpenses.length === 0 && isCurrentMonth && (
        <EmptyState
          className="mt-16"
          message={t('plannedExpenses.empty')}
          action={
            <Link to="/settings" className="text-sm text-accent hover:underline">
              {t('plannedExpenses.goToSettings')}
            </Link>
          }
        />
      )}

      {!isLoading && !isError && plannedExpenses.length === 0 && !isCurrentMonth && (
        <EmptyState className="mt-16" message={t('plannedExpenses.emptyMonth')} />
      )}

      {!isLoading && !isError && plannedExpenses.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="text-start">{t('plannedExpenses.dateHeader')}</Table.Th>
                <Table.Th className="text-start">{t('plannedExpenses.titleHeader')}</Table.Th>
                <Table.Th className="text-end">{t('plannedExpenses.amountHeader')}</Table.Th>
                <Table.Th className="text-start">{t('plannedExpenses.envelopeHeader')}</Table.Th>
                <Table.Th className="text-start">{t('plannedExpenses.confirmedHeader')}</Table.Th>
                <Table.Th className="text-end">{t('plannedExpenses.actionsHeader')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {plannedExpenses.map((expense) => (
                <PlannedExpenseRow
                  key={expense.id}
                  plannedExpense={expense}
                  categoryOptions={categoryOptions}
                  onReassign={(id, envelopeId) =>
                    updateMutation.mutateAsync({ id, payload: { envelope_id: envelopeId } })
                  }
                  onConfirm={(id) => updateMutation.mutateAsync({ id, payload: { is_confirmed: true } })}
                  onDelete={(id) => deleteMutation.mutateAsync(id)}
                />
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
