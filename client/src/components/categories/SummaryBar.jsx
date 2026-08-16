import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { formatShekels } from '../../utils/money';

export function SummaryBar({ categories }) {
  const { t } = useTranslation();
  const totals = categories.reduce(
    (acc, category) => ({
      budget: acc.budget + category.monthly_budget_agorot,
      spent: acc.spent + category.spent_agorot,
    }),
    { budget: 0, spent: 0 }
  );
  const remaining = totals.budget - totals.spent;

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
        <div>
          <p className="text-sm text-text-secondary">{t('categoryManagement.remainingBalance')}</p>
          <p className="text-xl font-semibold text-text-primary">{formatShekels(remaining)}</p>
        </div>
      </div>
    </Card>
  );
}
