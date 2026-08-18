import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Badge, Button, Card, Icon, Menu, Meter, Modal } from '../ui';
import { CategoryFormModal } from './CategoryFormModal';
import { getCategoryStatus, isCategoryAtRisk } from '../../utils/categoryStatus';
import { getCategoryAccentIndex, getCategoryIconName } from '../../utils/categoryIcon';
import { formatShekels, formatShekelsRounded } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

// Literal class strings (not templated) so Tailwind's JIT scanner picks
// them up — see docs/DASHBOARD-REDESIGN.md Step 7.
const ACCENT_CLASSES = {
  1: { chip: 'bg-cat-1-tint', icon: 'text-cat-1' },
  2: { chip: 'bg-cat-2-tint', icon: 'text-cat-2' },
  3: { chip: 'bg-cat-3-tint', icon: 'text-cat-3' },
  4: { chip: 'bg-cat-4-tint', icon: 'text-cat-4' },
  5: { chip: 'bg-cat-5-tint', icon: 'text-cat-5' },
  6: { chip: 'bg-cat-6-tint', icon: 'text-cat-6' },
};

// Same literal-string requirement as ACCENT_CLASSES above — `color` is one
// of the fixed getCategoryStatus() keys, but a template literal would hide
// the class name from Tailwind's JIT scanner.
const STATUS_TEXT_CLASSES = {
  'status-ok': 'text-status-ok',
  'status-warning': 'text-status-warning',
  'status-critical': 'text-status-critical',
  'status-danger': 'text-status-danger',
};

export function CategoryCard({ category, onDelete, onEdit, atRiskEnvelopeIds = [] }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const { color, status, percentUsed } = getCategoryStatus(category);
  // Forward-looking forecast signal, independent of the percent-used status
  // above — distinct from the "overBudget" badge (already-happened) so the
  // two don't collapse into the same red for the user.
  const atRisk = isCategoryAtRisk(category.id, atRiskEnvelopeIds);
  const remaining = category.monthly_budget_agorot - category.spent_agorot;
  const overspent = remaining < 0;
  const accent = ACCENT_CLASSES[getCategoryAccentIndex(category.name)];

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
      className={`group relative bg-bg-surface border border-border-card rounded-lg p-5 shadow-sm transition-shadow duration-base hover:shadow-md ${
        atRisk ? 'ring-1 ring-status-warning' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-md ${accent.chip}`}>
            <Icon name={getCategoryIconName(category.name)} size="sm" className={accent.icon} />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-strong">{category.name}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {t('categoryManagement.budgetLabel', { amount: formatShekelsRounded(category.monthly_budget_agorot) })}
            </p>
          </div>
        </div>

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={t('categoryManagement.cardMenu', { name: category.name })}
              className="opacity-100 transition-opacity duration-fast focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <Icon name="moreHorizontal" size="sm" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon name="pencil" size="sm" />} onClick={() => setEditOpen(true)}>
              {t('common.edit')}
            </Menu.Item>
            <Menu.Item leftSection={<Icon name="trash" size="sm" />} color="status-danger" onClick={openConfirm}>
              {t('common.delete')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs text-text-muted mb-1">{t('categoryManagement.spentLabel')}</p>
          <p className="font-mono text-xl font-semibold leading-none text-text-primary">
            {formatShekels(category.spent_agorot)}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-text-muted mb-1">
            {overspent ? t('categoryManagement.overByLabel') : t('categoryManagement.leftLabel')}
          </p>
          <p className={`font-mono text-sm font-semibold leading-none ${STATUS_TEXT_CLASSES[color]}`}>
            {formatShekels(Math.abs(remaining))}
          </p>
        </div>
      </div>

      <Meter
        percent={percentUsed * 100}
        color={color}
        label={t('categoryManagement.budgetMeterLabel', { name: category.name })}
      />

      <div className="flex items-center justify-between mt-2.5">
        <span className="font-mono text-2xs text-text-muted">
          {t('categoryManagement.percentUsed', { percent: Math.round(percentUsed * 100) })}
        </span>
        <div className="flex items-center gap-2">
          {atRisk && <Badge color="status-warning">{t('categoryManagement.atRisk')}</Badge>}
          <Badge color={color} variant={status === 'onTrack' ? 'light' : 'filled'}>
            {t(`categoryManagement.status.${status}`)}
          </Badge>
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
