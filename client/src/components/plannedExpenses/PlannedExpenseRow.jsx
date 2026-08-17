import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Select, Table } from '../ui';
import { formatDate } from '../../utils/date';
import { formatShekels } from '../../utils/money';
import { hasMissingAmount } from '../../utils/plannedExpenseStatus';
import { getErrorMessage } from '../../utils/errorMessages';

// One row per planned expense, each owning its own confirm-pending/error
// state — same reasoning as MissingAmountRow.jsx: a shared page-level
// mutation object can't tell the caller which row's click is in flight, so a
// Badge-as-button with no loading/error affordance looked "broken" (no
// visible feedback) even when the request itself succeeded or failed.
export function PlannedExpenseRow({ plannedExpense, categoryOptions, onReassign, onConfirm }) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const handleConfirm = async () => {
    setConfirmError('');
    setIsConfirming(true);
    try {
      await onConfirm(plannedExpense.id);
    } catch (err) {
      setConfirmError(getErrorMessage(err.message, t));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Table.Tr>
      <Table.Td className="text-start">{formatDate(plannedExpense.due_date)}</Table.Td>
      <Table.Td className="text-start">{plannedExpense.title}</Table.Td>
      <Table.Td className="text-end">
        {hasMissingAmount(plannedExpense) ? (
          <Badge color="status-warning">{t('plannedExpenses.missingAmount.badge')}</Badge>
        ) : (
          formatShekels(plannedExpense.amount_agorot)
        )}
      </Table.Td>
      <Table.Td className="text-start">
        <Select
          placeholder={t('plannedExpenses.envelopeNone')}
          data={categoryOptions}
          value={plannedExpense.envelope_id != null ? String(plannedExpense.envelope_id) : null}
          onChange={(value) => onReassign(plannedExpense.id, value ? Number(value) : null)}
          clearable
        />
      </Table.Td>
      <Table.Td className="text-start">
        {plannedExpense.is_confirmed ? (
          <Badge color="status-ok">{t('plannedExpenses.confirm')}</Badge>
        ) : (
          <div className="flex flex-col gap-1 items-start">
            <Button variant="outline" color="accent" size="xs" loading={isConfirming} onClick={handleConfirm}>
              {t('plannedExpenses.confirm')}
            </Button>
            {confirmError && (
              <p className="text-xs text-form-error" role="alert">
                {confirmError}
              </p>
            )}
          </div>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
