import { Card } from '../ui';
import { formatShekels } from '../../utils/money';

export function SummaryBar({ envelopes }) {
  const totals = envelopes.reduce(
    (acc, envelope) => ({
      budget: acc.budget + envelope.monthly_budget_agorot,
      spent: acc.spent + envelope.spent_agorot,
    }),
    { budget: 0, spent: 0 }
  );
  const remaining = totals.budget - totals.spent;

  return (
    <Card padding={0} className="bg-bg-surface border border-border-card rounded-lg">
      <div className="px-6 py-5 flex flex-wrap gap-8">
        <div>
          <p className="text-sm text-text-secondary">Total Budget</p>
          <p className="text-xl font-semibold text-text-primary">{formatShekels(totals.budget)}</p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">Total Spent</p>
          <p className="text-xl font-semibold text-text-primary">{formatShekels(totals.spent)}</p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">Remaining Balance</p>
          <p className="text-xl font-semibold text-text-primary">{formatShekels(remaining)}</p>
        </div>
      </div>
    </Card>
  );
}
