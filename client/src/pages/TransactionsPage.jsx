import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import transactionService from '../services/transactionService';
import categoryService from '../services/categoryService';
import { TransactionFilters, UNASSIGNED_VALUE } from '../components/transactions/TransactionFilters';
import { TransactionRow } from '../components/transactions/TransactionRow';
import { QuickEntryModal } from '../components/transactions/QuickEntryModal';
import { TransactionEditModal } from '../components/transactions/TransactionEditModal';
import { formatShekels } from '../utils/money';
import { PageHeader } from '../components/shared/PageHeader';

export function TransactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { month } = useMonth();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // The date-range filters are bounded to `month` (see TransactionFilters'
  // min/max props) — MonthNavigator changes `month` from shared context, so
  // this page can't intercept that click directly the way it could when
  // month was local state; reset on the resulting `month` change instead.
  useEffect(() => {
    setDateFrom('');
    setDateTo('');
  }, [month]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user.id, month],
    queryFn: () => transactionService.list(user.id, month),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user.id, month],
    queryFn: () => categoryService.list(user.id, month),
  });

  const quickEntryMutation = useMutation({
    mutationFn: (payload) => transactionService.create(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
      // New transactions change actual spend, which the forecast depends on
      // (docs/STATE.md's money-mutation-invalidates-forecast rule).
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => transactionService.update(id, payload),
    onSuccess: () => {
      // Reassigning envelope_id changes both the old and new envelope's
      // spent totals, plus overall forecast — same invalidation set as create.
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionService.remove(id),
    onSuccess: () => {
      // Removing a transaction changes the same three things creating one
      // does — same invalidation set as create/update.
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
    },
  });

  // Mantine's Select requires string option values (client/CLAUDE.md § Component
  // Boundary components pass through Mantine as-is) — category.id is a number
  // from the real API. Same conversion as QuickEntryModal.jsx / PlannedExpensesPage.jsx.
  const categoryOptions = categories.map((category) => ({ value: String(category.id), label: category.name }));

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (query && !transaction.description.toLowerCase().includes(query)) return false;

      if (categoryId === UNASSIGNED_VALUE && transaction.envelope_id) return false;
      if (categoryId && categoryId !== UNASSIGNED_VALUE && String(transaction.envelope_id) !== categoryId) return false;

      if (dateFrom && transaction.transaction_date < dateFrom) return false;
      if (dateTo && transaction.transaction_date > dateTo) return false;

      return true;
    });
  }, [transactions, search, categoryId, dateFrom, dateTo]);

  const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount_agorot, 0);

  return (
    <>
      <PageHeader />
      <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{t('transactions.title')}</h1>
        <Button variant="filled" color="accent" onClick={() => setIsQuickEntryOpen(true)}>
          {t('transactions.addTransaction')}
        </Button>
      </div>

      <div className="mt-6">
        <TransactionFilters
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          categoryOptions={categoryOptions}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
        />
      </div>

      {isLoading && <p className="text-text-secondary mt-6">{t('transactions.loading')}</p>}

      {!isLoading && transactions.length === 0 && (
        <p className="text-text-secondary mt-16 text-center">{t('transactions.emptyMonth')}</p>
      )}

      {!isLoading && transactions.length > 0 && filteredTransactions.length === 0 && (
        <p className="text-text-secondary mt-16 text-center">{t('transactions.emptyFiltered')}</p>
      )}

      {!isLoading && filteredTransactions.length > 0 && (
        <>
          <p className="text-sm text-text-secondary mt-6">
            {t('transactions.total', {
              count: filteredTransactions.length,
              amount: formatShekels(total),
            })}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-card text-start text-xs uppercase text-text-secondary">
                  <th className="py-2 pe-4 font-medium">{t('transactions.dateHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('transactions.descriptionHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('transactions.categoryHeader')}</th>
                  <th className="py-2 pe-4 font-medium text-end">{t('transactions.amountHeader')}</th>
                  <th className="py-2 ps-0 font-medium text-end">{t('transactions.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    categoryOptions={categoryOptions}
                    onReassign={(id, envelopeId) => updateMutation.mutate({ id, payload: { envelope_id: envelopeId } })}
                    onEdit={setEditingTransaction}
                    onDelete={(id) => deleteMutation.mutateAsync(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <QuickEntryModal
        opened={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onConfirm={(payload) => quickEntryMutation.mutateAsync(payload)}
      />

      <TransactionEditModal
        opened={editingTransaction != null}
        transaction={editingTransaction}
        categoryOptions={categoryOptions}
        onClose={() => setEditingTransaction(null)}
        onSubmit={(payload) => updateMutation.mutateAsync({ id: editingTransaction.id, payload })}
      />
      </div>
    </>
  );
}
