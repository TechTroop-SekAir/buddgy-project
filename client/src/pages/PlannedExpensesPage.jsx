import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Table } from '../components/ui';
import { PlannedExpenseFormModal } from '../components/plannedExpenses/PlannedExpenseFormModal';
import { PlannedExpenseRow } from '../components/plannedExpenses/PlannedExpenseRow';
import { useAuth } from '../context/AuthContext';
import plannedExpenseService from '../services/plannedExpenseService';
import categoryService from '../services/categoryService';
import { getCurrentMonth } from '../utils/month';

export function PlannedExpensesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = getCurrentMonth();
  const queryKey = ['planned-expenses', user.id, month];
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: plannedExpenses = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => plannedExpenseService.list(user.id, month),
  });

  const { data: categories = [] } = useQuery({
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{t('plannedExpenses.title')}</h1>
        <div className="flex items-center gap-4">
          <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
            {t('plannedExpenses.addButton')}
          </Button>
          <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text-primary">
            {t('nav.backToDashboard')}
          </Link>
        </div>
      </div>

      <PlannedExpenseFormModal
        opened={isAddOpen}
        categoryOptions={categoryOptions}
        onClose={() => setIsAddOpen(false)}
        onSubmit={(payload) => createMutation.mutateAsync(payload)}
      />

      {isLoading && <p className="text-text-secondary mt-6">{t('plannedExpenses.loading')}</p>}

      {!isLoading && plannedExpenses.length === 0 && (
        <div className="flex flex-col items-center text-center mt-16 gap-3">
          <p className="text-text-secondary">{t('plannedExpenses.empty')}</p>
          <Link to="/settings" className="text-sm text-accent hover:underline">
            {t('plannedExpenses.goToSettings')}
          </Link>
        </div>
      )}

      {!isLoading && plannedExpenses.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="text-start">{t('plannedExpenses.dateHeader')}</Table.Th>
                <Table.Th className="text-start">{t('plannedExpenses.titleHeader')}</Table.Th>
                <Table.Th className="text-end">{t('plannedExpenses.amountHeader')}</Table.Th>
                <Table.Th className="text-start">{t('plannedExpenses.envelopeHeader')}</Table.Th>
                <Table.Th className="text-start">{t('plannedExpenses.confirmedHeader')}</Table.Th>
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
                />
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
