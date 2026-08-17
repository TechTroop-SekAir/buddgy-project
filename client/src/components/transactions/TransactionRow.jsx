import { useTranslation } from 'react-i18next';
import { Button, Select } from '../ui';
import { formatShekels } from '../../utils/money';
import { formatDate } from '../../utils/date';

export function TransactionRow({ transaction, categoryOptions, onReassign, onEdit }) {
  const { t } = useTranslation();

  return (
    <tr className="border-b border-border-card last:border-0">
      <td className="py-3 pe-4 text-sm text-text-secondary whitespace-nowrap">
        {formatDate(transaction.transaction_date)}
      </td>
      <td className="py-3 pe-4 text-sm text-text-primary">{transaction.description}</td>
      <td className="py-3 pe-4 text-sm text-text-secondary whitespace-nowrap">
        <Select
          size="xs"
          placeholder={t('transactions.uncategorized')}
          data={categoryOptions}
          value={transaction.envelope_id != null ? String(transaction.envelope_id) : null}
          onChange={(value) => onReassign(transaction.id, value ? Number(value) : null)}
          clearable
        />
      </td>
      <td className="py-3 pe-4 text-sm font-medium text-text-primary text-end whitespace-nowrap">
        {formatShekels(transaction.amount_agorot)}
      </td>
      <td className="py-3 ps-0 text-sm text-end whitespace-nowrap">
        <Button variant="subtle" color="gray" size="xs" onClick={() => onEdit(transaction)}>
          {t('common.edit')}
        </Button>
      </td>
    </tr>
  );
}
