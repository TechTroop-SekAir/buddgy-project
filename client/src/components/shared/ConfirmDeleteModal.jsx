import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal } from '../ui';

// Consolidates the delete-confirmation dialog that TransactionRow,
// PlannedExpenseRow, and CategoryCard each used to hand-roll independently
// (identical Modal/Button/error-state shape).
export function ConfirmDeleteModal({
  opened,
  title,
  body,
  warning,
  onConfirm,
  onCancel,
  loading = false,
  error = '',
  confirmLabel,
  cancelLabel,
}) {
  const { t } = useTranslation();

  return (
    <Modal opened={opened} onClose={onCancel} title={title}>
      <p className={`text-sm text-text-secondary ${warning ? 'mb-2' : 'mb-6'}`}>{body}</p>
      {warning && <p className="text-sm text-status-warning mb-4">{warning}</p>}
      {error && <Alert className="mb-4">{error}</Alert>}
      <div className="flex justify-end gap-3">
        <Button variant="outline" color="gray" onClick={onCancel} disabled={loading}>
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button color="status-danger" onClick={onConfirm} loading={loading}>
          {confirmLabel ?? t('common.delete')}
        </Button>
      </div>
    </Modal>
  );
}
