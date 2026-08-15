import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Button, Modal, NumberInput, TextInput } from '../ui';
import { agorotToShekels, shekelsToAgorot } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

export function EditEnvelopeModal({ opened, envelope, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: {
      name: envelope?.name ?? '',
      budgetShekels: envelope ? String(agorotToShekels(envelope.monthly_budget_agorot)) : '',
    },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : t('addEnvelopeModal.nameRequired')),
      budgetShekels: (value) => (Number(value) > 0 ? null : t('addEnvelopeModal.budgetInvalid')),
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
        name: values.name.trim(),
        monthly_budget_agorot: shekelsToAgorot(Number(values.budgetShekels)),
      });
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title={t('editEnvelopeModal.title')}>
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <TextInput
          id="envelope-edit-name"
          name="name"
          autoComplete="off"
          label={t('addEnvelopeModal.nameLabel')}
          placeholder={t('addEnvelopeModal.namePlaceholder')}
          required
          {...form.getInputProps('name')}
        />
        <NumberInput
          id="envelope-edit-budget"
          name="monthlyBudget"
          autoComplete="off"
          label={t('addEnvelopeModal.budgetLabel')}
          placeholder="0"
          leftSection="₪"
          min={0}
          required
          {...form.getInputProps('budgetShekels')}
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
            {t('editEnvelopeModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
