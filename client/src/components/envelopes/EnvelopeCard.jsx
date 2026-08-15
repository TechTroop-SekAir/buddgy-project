import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Modal, Progress } from '../ui';
import { EditEnvelopeModal } from './EditEnvelopeModal';
import { getEnvelopeStatus } from '../../utils/envelopeStatus';
import { formatShekels } from '../../utils/money';

export function EnvelopeCard({ envelope, onDelete, onEdit }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { color, status, percentUsed } = getEnvelopeStatus(envelope);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(envelope.id);
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Card padding={0} className="bg-bg-surface border border-border-card rounded-lg">
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{envelope.name}</h3>
          <Badge color={color}>{t(`envelopes.status.${status}`)}</Badge>
        </div>
        <Progress value={Math.min(percentUsed * 100, 100)} color={color} />
        <p className="text-sm text-text-secondary">
          {t('envelopes.spentOf', {
            spent: formatShekels(envelope.spent_agorot),
            budget: formatShekels(envelope.monthly_budget_agorot),
          })}
        </p>
        <div className="flex gap-2 self-start">
          <Button variant="outline" color="gray" size="sm" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
          <Button variant="outline" color="status-danger" size="sm" onClick={() => setConfirmOpen(true)}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <EditEnvelopeModal
        opened={editOpen}
        envelope={envelope}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => onEdit(envelope.id, payload)}
      />

      <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('envelopes.deleteConfirmTitle')}>
        <p className="text-sm text-text-secondary mb-6">
          {t('envelopes.deleteConfirmBody', { name: envelope.name })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" color="gray" onClick={() => setConfirmOpen(false)} disabled={isDeleting}>
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
