import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Modal, Progress } from '../ui';
import { CategoryFormModal } from './CategoryFormModal';
import { getCategoryStatus } from '../../utils/categoryStatus';
import { formatShekels } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

export function CategoryCard({ category, onDelete, onEdit }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const { color, status, percentUsed } = getCategoryStatus(category);

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
      await onDelete(category.id);
      setConfirmOpen(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err.message, t));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card padding={0} className="bg-bg-surface border border-border-card rounded-lg">
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{category.name}</h3>
          <Badge color={color}>{t(`categoryManagement.status.${status}`)}</Badge>
        </div>
        <Progress value={Math.min(percentUsed * 100, 100)} color={color} />
        <p className="text-sm text-text-secondary">
          {t('categoryManagement.spentOf', {
            spent: formatShekels(category.spent_agorot),
            budget: formatShekels(category.monthly_budget_agorot),
          })}
        </p>
        <div className="flex gap-2 self-start">
          <Button variant="outline" color="gray" size="sm" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
          <Button variant="outline" color="status-danger" size="sm" onClick={openConfirm}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <CategoryFormModal
        opened={editOpen}
        category={category}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => onEdit(category.id, payload)}
      />

      <Modal opened={confirmOpen} onClose={handleCancelDelete} title={t('categoryManagement.deleteConfirmTitle')}>
        <p className="text-sm text-text-secondary mb-6">
          {t('categoryManagement.deleteConfirmBody', { name: category.name })}
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
    </Card>
  );
}
