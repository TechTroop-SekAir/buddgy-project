import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Select, Table } from '../ui';
import { ConfirmDeleteModal } from '../shared/ConfirmDeleteModal';
import { formatDate } from '../../utils/date';
import { formatShekels } from '../../utils/money';
import { hasMissingAmount } from '../../utils/plannedExpenseStatus';
import { getErrorMessage } from '../../utils/errorMessages';

// One row per planned expense, each owning its own confirm-pending/error
// state — same reasoning as MissingAmountRow.jsx: a shared page-level
// mutation object can't tell the caller which row's click is in flight, so a
// Badge-as-button with no loading/error affordance looked "broken" (no
// visible feedback) even when the request itself succeeded or failed.
export function PlannedExpenseRow({ plannedExpense, categoryOptions, onReassign, onConfirm, onDelete }) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState('');

  const handleReassign = async (value) => {
    setReassignError('');
    setIsReassigning(true);
    try {
      await onReassign(plannedExpense.id, value ? Number(value) : null);
    } catch (err) {
      setReassignError(getErrorMessage(err.message, t));
    } finally {
      setIsReassigning(false);
    }
  };

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

  const openDeleteConfirm = () => {
    setDeleteError('');
    setDeleteConfirmOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteError('');
    setDeleteConfirmOpen(false);
  };

  const handleConfirmDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await onDelete(plannedExpense.id);
      setDeleteConfirmOpen(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err.message, t));
    } finally {
      setIsDeleting(false);
    }
  };

  // Deleting a confirmed row deletes its linked transaction too (mirrors
  // unconfirm) — warn before that money silently disappears from the ledger.
  const deleteWarningKey = plannedExpense.is_confirmed
    ? 'plannedExpenses.deleteConfirmConfirmedWarning'
    : plannedExpense.source === 'calendar'
      ? 'plannedExpenses.deleteConfirmCalendarWarning'
      : null;

  return (
    <Table.Tr>
      <Table.Td className="text-start">{formatDate(plannedExpense.due_date)}</Table.Td>
      <Table.Td className="text-start min-w-[140px]">{plannedExpense.title}</Table.Td>
      <Table.Td className="text-end">
        {hasMissingAmount(plannedExpense) ? (
          <Badge color="status-warning">{t('plannedExpenses.missingAmount.badge')}</Badge>
        ) : (
          formatShekels(plannedExpense.amount_agorot)
        )}
      </Table.Td>
      <Table.Td className="text-start min-w-[140px]">
        <Select
          placeholder={t('plannedExpenses.envelopeNone')}
          data={categoryOptions}
          value={plannedExpense.envelope_id != null ? String(plannedExpense.envelope_id) : null}
          onChange={handleReassign}
          disabled={isReassigning}
          clearable
        />
        {reassignError && (
          <Alert size="xs" className="mt-1">
            {reassignError}
          </Alert>
        )}
      </Table.Td>
      <Table.Td className="text-start">
        {plannedExpense.is_confirmed ? (
          <Badge color="status-ok">{t('plannedExpenses.confirm')}</Badge>
        ) : (
          <div className="flex flex-col gap-1 items-start">
            <Button variant="outline" color="accent" size="md" loading={isConfirming} onClick={handleConfirm}>
              {t('plannedExpenses.confirm')}
            </Button>
            {confirmError && <Alert size="xs">{confirmError}</Alert>}
          </div>
        )}
      </Table.Td>
      <Table.Td className="text-end">
        <Button variant="subtle" color="status-danger" size="md" onClick={openDeleteConfirm}>
          {t('common.delete')}
        </Button>
      </Table.Td>

      <ConfirmDeleteModal
        opened={deleteConfirmOpen}
        title={t('plannedExpenses.deleteConfirmTitle')}
        body={t('plannedExpenses.deleteConfirmBody', { title: plannedExpense.title })}
        warning={deleteWarningKey ? t(deleteWarningKey) : null}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={isDeleting}
        error={deleteError}
      />
    </Table.Tr>
  );
}
