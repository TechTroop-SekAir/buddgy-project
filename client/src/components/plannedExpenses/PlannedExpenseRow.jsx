import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Modal, Select, Table } from '../ui';
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
          onChange={(value) => onReassign(plannedExpense.id, value ? Number(value) : null)}
          clearable
        />
      </Table.Td>
      <Table.Td className="text-start">
        {plannedExpense.is_confirmed ? (
          <Badge color="status-ok">{t('plannedExpenses.confirm')}</Badge>
        ) : (
          <div className="flex flex-col gap-1 items-start">
            <Button variant="outline" color="accent" size="md" loading={isConfirming} onClick={handleConfirm}>
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
      <Table.Td className="text-end">
        <Button variant="subtle" color="status-danger" size="md" onClick={openDeleteConfirm}>
          {t('common.delete')}
        </Button>
      </Table.Td>

      <Modal opened={deleteConfirmOpen} onClose={handleCancelDelete} title={t('plannedExpenses.deleteConfirmTitle')}>
        <p className="text-sm text-text-secondary mb-2">
          {t('plannedExpenses.deleteConfirmBody', { title: plannedExpense.title })}
        </p>
        {plannedExpense.source === 'calendar' && (
          <p className="text-sm text-status-warning mb-4">{t('plannedExpenses.deleteConfirmCalendarWarning')}</p>
        )}
        {deleteError && (
          <p className="text-sm text-form-error mb-4" role="alert">
            {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" color="gray" onClick={handleCancelDelete} disabled={isDeleting}>
            {t('common.cancel')}
          </Button>
          <Button color="status-danger" onClick={handleConfirmDelete} loading={isDeleting}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </Table.Tr>
  );
}
