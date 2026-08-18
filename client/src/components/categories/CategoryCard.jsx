import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Progress } from '../ui';
import { CategoryFormModal } from './CategoryFormModal';
import { ConfirmDeleteModal } from '../shared/ConfirmDeleteModal';
import { getCategoryStatus, isCategoryAtRisk } from '../../utils/categoryStatus';
import { formatShekels } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

export function CategoryCard({ category, onDelete, onEdit, atRiskEnvelopeIds = [] }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const { color, status, percentUsed } = getCategoryStatus(category);
  // Forward-looking forecast signal, independent of the percent-used status
  // above — distinct from the "overBudget" badge (already-happened). Suppressed
  // once the category has actually exceeded its budget: "at risk" means
  // "projected to exceed," which is meaningless (and redundant) once it already has.
  const atRisk = status !== 'overBudget' && isCategoryAtRisk(category.id, atRiskEnvelopeIds);

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
    <Card
      padding={0}
      className={`bg-bg-surface border rounded-lg ${atRisk ? 'border-status-warning' : 'border-border-card'}`}
    >
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{category.name}</h3>
          <div className="flex items-center gap-2">
            {atRisk && <Badge color="status-warning">{t('categoryManagement.atRisk')}</Badge>}
            <Badge color={color}>{t(`categoryManagement.status.${status}`)}</Badge>
          </div>
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

      <ConfirmDeleteModal
        opened={confirmOpen}
        title={t('categoryManagement.deleteConfirmTitle')}
        body={t('categoryManagement.deleteConfirmBody', { name: category.name })}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={isDeleting}
        error={deleteError}
      />
    </Card>
  );
}
