import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, Skeleton, Table } from '../components/ui';
import { PlannedExpenseFormModal } from '../components/plannedExpenses/PlannedExpenseFormModal';
import { PlannedExpenseRow } from '../components/plannedExpenses/PlannedExpenseRow';
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

  const {
    data: plannedExpenses = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => plannedExpenseService.list(user.id, month),
  });

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
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => plannedExpenseService.create(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.remove(id),
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
        onSubmit={(payload) => createMutation.mutateAsync(payload)}
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

      {!isLoading && !isError && plannedExpenses.length === 0 && isCurrentMonth && (
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
