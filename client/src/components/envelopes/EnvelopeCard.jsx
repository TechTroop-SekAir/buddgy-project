import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Modal, Progress } from '../ui';
import { getEnvelopeStatus } from '../../utils/envelopeStatus';
import { formatShekels } from '../../utils/money';

export function EnvelopeCard({ envelope, onDelete }) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { color, label, percentUsed } = getEnvelopeStatus(envelope, t);

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
          <Badge color={color}>{label}</Badge>
        </div>
        <Progress value={Math.min(percentUsed * 100, 100)} color={color} />
        <p className="text-sm text-text-secondary">
          {t('envelopes.card.spentOf', {
            spent: formatShekels(envelope.spent_agorot),
            budget: formatShekels(envelope.monthly_budget_agorot),
          })}
        </p>
        <Button
          variant="outline"
          color="status-danger"
          size="sm"
          className="self-start"
          onClick={() => setConfirmOpen(true)}
        >
          {t('common.delete')}
        </Button>
      </div>

      <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('envelopes.card.deleteConfirmTitle')}>
        <p className="text-sm text-text-secondary mb-6">
          {t('envelopes.card.deleteConfirmBody', { name: envelope.name })}
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
