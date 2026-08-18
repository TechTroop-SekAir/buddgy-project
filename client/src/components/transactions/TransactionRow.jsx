import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Select } from '../ui';
import { formatShekels } from '../../utils/money';
import { formatDate } from '../../utils/date';
import { getErrorMessage } from '../../utils/errorMessages';

export function TransactionRow({ transaction, categoryOptions, onReassign, onEdit, onDelete }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
          onChange={(value) => onReassign(transaction.id, value ? Number(value) : null)}
          clearable
        />
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

      <Modal opened={confirmOpen} onClose={handleCancelDelete} title={t('transactions.deleteConfirmTitle')}>
        <p className="text-sm text-text-secondary mb-6">
          {t('transactions.deleteConfirmBody', { description: transaction.description })}
        </p>
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
    </tr>
  );
}
