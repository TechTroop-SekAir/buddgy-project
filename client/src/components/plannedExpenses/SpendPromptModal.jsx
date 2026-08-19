import { useEffect, useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal, NumberInput, Select } from '../ui';
import { formatDate } from '../../utils/date';
import { shekelsToAgorot, agorotToShekels } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

// "How much will you spend on this?" — a plain manual form (no AI on the
// amount, by design; see docs/features/UPCOMING-EVENTS.md § Decisions).
// Unlike PlannedExpenseFormModal (which creates a new manual row), this
// edits an existing calendar-synced one: title/date are the event's own and
// shown read-only, only amount + category are asked for. Submitting also
// confirms the row, moving it into the forecast's confirmed total.
export function SpendPromptModal({ opened, plannedExpense, categoryOptions, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: { amountShekels: '', envelopeId: '' },
    validate: {
      amountShekels: (value) => (Number(value) > 0 ? null : t('addPlannedExpenseModal.amountInvalid')),
    },
  });

  // Re-seed the form whenever a different row opens, since the modal instance is shared.
  useEffect(() => {
    if (!opened || !plannedExpense) return;
    form.setValues({
      amountShekels: plannedExpense.amount_agorot ? String(agorotToShekels(plannedExpense.amount_agorot)) : '',
      envelopeId: plannedExpense.envelope_id != null ? String(plannedExpense.envelope_id) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, plannedExpense?.id]);

  const handleClose = () => {
    setSubmitError('');
    onClose();
  };

  const handleSubmit = async (values) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit(plannedExpense.id, {
        amount_agorot: shekelsToAgorot(Number(values.amountShekels)),
        envelope_id: values.envelopeId ? Number(values.envelopeId) : null,
        is_confirmed: true,
      });
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!plannedExpense) return null;

  return (
    <Modal opened={opened} onClose={handleClose} title={t('plannedExpenses.upcoming.spendModalTitle')}>
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{plannedExpense.title}</p>
          <p className="text-xs text-text-secondary">{formatDate(plannedExpense.due_date)}</p>
        </div>
        <NumberInput
          id="spend-prompt-amount"
          name="amountShekels"
          autoComplete="off"
          label={t('addPlannedExpenseModal.amountLabel')}
          placeholder="0"
          leftSection="₪"
          min={0}
          required
          {...form.getInputProps('amountShekels')}
        />
        <Select
          id="spend-prompt-envelope"
          label={t('addPlannedExpenseModal.envelopeLabel')}
          placeholder={t('plannedExpenses.envelopeNone')}
          data={categoryOptions}
          clearable
          {...form.getInputProps('envelopeId')}
        />
        {submitError && <Alert>{submitError}</Alert>}
        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="outline" color="gray" onClick={handleClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="filled" color="accent" loading={isSubmitting}>
            {t('plannedExpenses.upcoming.spendModalSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
