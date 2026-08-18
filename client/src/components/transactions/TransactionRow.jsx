import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Select } from '../ui';
import { ConfirmDeleteModal } from '../shared/ConfirmDeleteModal';
import { formatShekels } from '../../utils/money';
import { formatDate } from '../../utils/date';
import { getErrorMessage } from '../../utils/errorMessages';

export function TransactionRow({ transaction, categoryOptions, onReassign, onEdit, onDelete }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState('');

  const handleReassign = async (value) => {
    setReassignError('');
    setIsReassigning(true);
    try {
      await onReassign(transaction.id, value ? Number(value) : null);
    } catch (err) {
      setReassignError(getErrorMessage(err.message, t));
    } finally {
      setIsReassigning(false);
    }
  };

  const openConfirm = () => {
    setDeleteError('');
    setConfirmOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteError('');
    setConfirmOpen(false);
  };

  const handleConfirmDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await onDelete(transaction.id);
      setConfirmOpen(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err.message, t));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <tr className="border-b border-border-card last:border-0">
      <td className="py-3 pe-4 text-sm text-text-secondary whitespace-nowrap">
        {formatDate(transaction.transaction_date)}
      </td>
      <td className="py-3 pe-4 text-sm text-text-primary min-w-[140px]">{transaction.description}</td>
      <td className="py-3 pe-4 text-sm text-text-secondary whitespace-nowrap min-w-[140px]">
        <Select
          size="xs"
          placeholder={t('transactions.uncategorized')}
          data={categoryOptions}
          value={transaction.envelope_id != null ? String(transaction.envelope_id) : null}
          onChange={handleReassign}
          disabled={isReassigning}
          clearable
        />
        {reassignError && (
          <Alert size="xs" className="mt-1">
            {reassignError}
          </Alert>
        )}
      </td>
      <td className="py-3 pe-4 text-sm font-medium text-text-primary text-end whitespace-nowrap">
        {formatShekels(transaction.amount_agorot)}
      </td>
      <td className="py-3 ps-0 text-sm text-end whitespace-nowrap">
        <div className="flex justify-end gap-2">
          <Button variant="subtle" color="gray" size="md" onClick={() => onEdit(transaction)}>
            {t('common.edit')}
          </Button>
          <Button variant="subtle" color="status-danger" size="md" onClick={openConfirm}>
            {t('common.delete')}
          </Button>
        </div>
      </td>

      <ConfirmDeleteModal
        opened={confirmOpen}
        title={t('transactions.deleteConfirmTitle')}
        body={t('transactions.deleteConfirmBody', { description: transaction.description })}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={isDeleting}
        error={deleteError}
      />
    </tr>
  );
}
