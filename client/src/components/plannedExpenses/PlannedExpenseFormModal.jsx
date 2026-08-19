import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Alert, Button, DateInput, Modal, NumberInput, Select, TextInput } from '../ui';
import { shekelsToAgorot } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';
import { addMonthsToDate } from '../../utils/date';

// Every manual planned expense recurs monthly — envelope budgeting is a
// monthly cycle by definition, so there's no one-off case to opt out of.
// A recurring row isn't a single DB concept — it's N independent
// planned_expenses rows, one per month from today through the end date
// entered, same as how a recurring Google Calendar event already syncs into
// N independent rows (one per occurrence, server/services/
// calendarSyncService.js). No shared "series" id, so each occurrence can be
// edited/deleted individually afterward, same as a synced one.
const MAX_RECURRING_OCCURRENCES = 120; // 10 years of monthly rows — a safety cap, not a user-facing limit

// Manual planned expenses (source: 'manual') — the calendar-synced half of
// planned_expenses is still read-only here, this only adds new rows.
export function PlannedExpenseFormModal({ opened, categoryOptions, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm({
    initialValues: {
      title: '',
      amountShekels: '',
      endDate: '',
      envelopeId: '',
    },
    validate: {
      title: (value) => (value.trim().length > 0 ? null : t('addPlannedExpenseModal.titleRequired')),
      amountShekels: (value) => (Number(value) > 0 ? null : t('addPlannedExpenseModal.amountInvalid')),
      endDate: (value) => {
        if (!value) return t('addPlannedExpenseModal.endDateRequired');
        if (value < today) return t('addPlannedExpenseModal.endDateBeforeToday');
        return null;
      },
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
      const basePayload = {
        title: values.title.trim(),
        amount_agorot: shekelsToAgorot(Number(values.amountShekels)),
        envelope_id: values.envelopeId ? Number(values.envelopeId) : null,
      };
      // Monthly occurrences from today through endDate, inclusive.
      // 'YYYY-MM-DD' strings compare lexicographically the same as
      // chronologically, so a plain <= works without parsing to Date objects.
      const payloads = [];
      for (let i = 0; i < MAX_RECURRING_OCCURRENCES; i += 1) {
        const occurrenceDate = addMonthsToDate(today, i);
        if (occurrenceDate > values.endDate) break;
        payloads.push({ ...basePayload, due_date: occurrenceDate });
      }

      await onSubmit(payloads);
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
          <span className="text-sm font-medium text-text-primary">{t('addPlannedExpenseModal.endDateLabel')}</span>
          <DateInput
            id="planned-expense-end-date"
            name="endDate"
            className="rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            min={today}
            required
            {...form.getInputProps('endDate')}
          />
          <span className="text-xs text-text-secondary">{t('addPlannedExpenseModal.endDateHint')}</span>
        </label>
        <Select
          id="planned-expense-envelope"
          label={t('addPlannedExpenseModal.envelopeLabel')}
          placeholder={t('plannedExpenses.envelopeNone')}
          data={categoryOptions}
          clearable
          {...form.getInputProps('envelopeId')}
        />
        {categoryOptions.length === 0 && (
          <p className="text-xs text-text-secondary">{t('addPlannedExpenseModal.noCategoriesHint')}</p>
        )}
        {submitError && <Alert>{submitError}</Alert>}
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
