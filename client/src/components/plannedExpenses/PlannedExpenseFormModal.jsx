import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Button, DateInput, Modal, NumberInput, Select, TextInput } from '../ui';
import { shekelsToAgorot } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

// Manual one-off planned expenses (source: 'manual') — the calendar-synced
// half of planned_expenses is still read-only here, this only adds new rows.
export function PlannedExpenseFormModal({ opened, categoryOptions, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: {
      title: '',
      amountShekels: '',
      dueDate: '',
      envelopeId: '',
    },
    validate: {
      title: (value) => (value.trim().length > 0 ? null : t('addPlannedExpenseModal.titleRequired')),
      amountShekels: (value) => (Number(value) > 0 ? null : t('addPlannedExpenseModal.amountInvalid')),
      dueDate: (value) => (value ? null : t('addPlannedExpenseModal.dueDateRequired')),
    },
  });

  const handleClose = () => {
    form.reset();
    setSubmitError('');
    onClose();
  };

  const handleSubmit = async (values) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        amount_agorot: shekelsToAgorot(Number(values.amountShekels)),
        due_date: values.dueDate,
        envelope_id: values.envelopeId ? Number(values.envelopeId) : null,
      });
      form.reset();
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title={t('addPlannedExpenseModal.title')}>
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <TextInput
          id="planned-expense-title"
          name="title"
          autoComplete="off"
          label={t('addPlannedExpenseModal.titleLabel')}
          placeholder={t('addPlannedExpenseModal.titlePlaceholder')}
          required
          {...form.getInputProps('title')}
        />
        <NumberInput
          id="planned-expense-amount"
          name="amountShekels"
          autoComplete="off"
          label={t('addPlannedExpenseModal.amountLabel')}
          placeholder="0"
          leftSection="₪"
          min={0}
          required
          {...form.getInputProps('amountShekels')}
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('addPlannedExpenseModal.dueDateLabel')}</span>
          <DateInput
            id="planned-expense-due-date"
            name="dueDate"
            className="rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            required
            {...form.getInputProps('dueDate')}
          />
        </label>
        <Select
          id="planned-expense-envelope"
          label={t('addPlannedExpenseModal.envelopeLabel')}
          placeholder={t('plannedExpenses.envelopeNone')}
          data={categoryOptions}
          clearable
          {...form.getInputProps('envelopeId')}
        />
        {submitError && (
          <p className="text-sm text-form-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="outline" color="gray" onClick={handleClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="filled" color="accent" loading={isSubmitting}>
            {t('addPlannedExpenseModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
