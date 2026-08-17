import { useEffect, useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Button, DateInput, Modal, NumberInput, Select, TextInput } from '../ui';
import { agorotToShekels, shekelsToAgorot } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

function toFormValues(transaction) {
  return {
    amountShekels: transaction ? String(agorotToShekels(transaction.amount_agorot)) : '',
    description: transaction?.description ?? '',
    transactionDate: transaction?.transaction_date ?? '',
    envelopeId: transaction?.envelope_id != null ? String(transaction.envelope_id) : '',
  };
}

// Lightweight edit form, deliberately not a retrofit of QuickEntryModal —
// that component is a multi-step AI-parse flow with no natural "edit an
// existing row" entry point. This follows CategoryFormModal.jsx's plain
// single-purpose useForm pattern instead.
export function TransactionEditModal({ opened, transaction, categoryOptions, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: toFormValues(transaction),
    validate: {
      amountShekels: (value) => (Number(value) > 0 ? null : t('transactionEditModal.amountInvalid')),
      description: (value) => (value.trim().length > 0 ? null : t('transactionEditModal.descriptionRequired')),
      transactionDate: (value) => (value ? null : t('transactionEditModal.dateRequired')),
    },
  });

  // This modal is a single shared instance across every row (unlike
  // CategoryFormModal, which CategoryCard mounts one-per-card with a fixed
  // `category` prop) — `transaction` changes identity on every "Edit" click
  // without the component remounting, so useForm's one-time `initialValues`
  // never resyncs on its own. Re-seed explicitly whenever the modal opens
  // with a (possibly new) transaction.
  useEffect(() => {
    if (opened) {
      form.setValues(toFormValues(transaction));
      form.resetDirty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction, opened]);

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
        amount_agorot: shekelsToAgorot(Number(values.amountShekels)),
        description: values.description.trim(),
        transaction_date: values.transactionDate,
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
    <Modal opened={opened} onClose={handleClose} title={t('transactionEditModal.title')}>
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <NumberInput
          id="transaction-edit-amount"
          name="amountShekels"
          autoComplete="off"
          label={t('transactionEditModal.amountLabel')}
          leftSection="₪"
          min={0}
          required
          {...form.getInputProps('amountShekels')}
        />
        <TextInput
          id="transaction-edit-description"
          name="description"
          autoComplete="off"
          label={t('transactionEditModal.descriptionLabel')}
          required
          {...form.getInputProps('description')}
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactionEditModal.dateLabel')}</span>
          <DateInput
            id="transaction-edit-date"
            name="transactionDate"
            className="rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            required
            {...form.getInputProps('transactionDate')}
          />
        </label>
        <Select
          id="transaction-edit-envelope"
          label={t('transactionEditModal.envelopeLabel')}
          placeholder={t('transactions.uncategorized')}
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
            {t('transactionEditModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
