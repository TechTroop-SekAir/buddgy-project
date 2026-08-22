import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Drawer, EmptyState, Skeleton } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useMonth } from '../../context/MonthContext';
import transactionService from '../../services/transactionService';
import { formatShekels } from '../../utils/money';
import { formatDate } from '../../utils/date';

// Read-only — reassign/edit/delete already live on /transactions. This is
// purely "what makes up this category's spending," opened from clicking a
// CategoryCard's body (docs/features/HOMEPAGE-FIXES.md § 3.3).
export function CategoryDetailsDrawer({ opened, category, onClose }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { month } = useMonth();

  const {
    data: transactions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['transactions', user.id, month, category?.id],
    queryFn: () => transactionService.list(user.id, month, { envelopeId: category.id }),
    enabled: opened && category != null,
  });

  return (
    <Drawer opened={opened} onClose={onClose} position="end" title={category?.name} padding="lg">
      {isLoading && (
        <div className="flex flex-col gap-2" aria-label={t('categoryDetailsDrawer.loading')}>
          <Skeleton height={40} radius="sm" />
          <Skeleton height={40} radius="sm" />
          <Skeleton height={40} radius="sm" />
        </div>
      )}

      {!isLoading && isError && <Alert>{t('categoryDetailsDrawer.error')}</Alert>}

      {!isLoading && !isError && transactions.length === 0 && (
        <EmptyState message={t('categoryDetailsDrawer.empty')} />
      )}

      {!isLoading && !isError && transactions.length > 0 && (
        <div className="flex flex-col">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">{transaction.description}</p>
                <p className="text-xs text-text-secondary">{formatDate(transaction.transaction_date)}</p>
              </div>
              <p className="shrink-0 num-tabular font-mono text-sm font-medium text-text-primary">
                {formatShekels(transaction.amount_agorot)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
