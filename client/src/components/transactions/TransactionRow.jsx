import { formatShekels } from '../../utils/money';
import { formatDate } from '../../utils/date';

export function TransactionRow({ transaction, categoryLabel }) {
  return (
    <tr className="border-b border-border-card last:border-0">
      <td className="py-3 pe-4 text-sm text-text-secondary whitespace-nowrap">
        {formatDate(transaction.transaction_date)}
      </td>
      <td className="py-3 pe-4 text-sm text-text-primary">{transaction.description}</td>
      <td className="py-3 pe-4 text-sm text-text-secondary whitespace-nowrap">{categoryLabel}</td>
      <td className="py-3 pe-4 text-sm font-medium text-text-primary text-end whitespace-nowrap">
        {formatShekels(transaction.amount_agorot)}
      </td>
    </tr>
  );
}
