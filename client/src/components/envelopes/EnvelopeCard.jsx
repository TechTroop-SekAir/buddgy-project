import { useState } from 'react';
import { Badge, Button, Card, Modal, Progress } from '../ui';
import { getEnvelopeStatus } from '../../utils/envelopeStatus';
import { formatShekels } from '../../utils/money';

export function EnvelopeCard({ envelope, onDelete }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { color, label, percentUsed } = getEnvelopeStatus(envelope);

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
          {formatShekels(envelope.spent_agorot)} of {formatShekels(envelope.monthly_budget_agorot)} spent
        </p>
        <Button
          variant="outline"
          color="status-danger"
          size="sm"
          className="self-start"
          onClick={() => setConfirmOpen(true)}
        >
          Delete
        </Button>
      </div>

      <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete envelope?">
        <p className="text-sm text-text-secondary mb-6">
          This will permanently delete &quot;{envelope.name}&quot;. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" color="gray" onClick={() => setConfirmOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button color="status-danger" onClick={handleConfirmDelete} loading={isDeleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
