import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Button, Modal, NumberInput, TextInput } from '../ui';
import { shekelsToAgorot } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

const SUGGESTED_CATEGORY_KEYS = ['pets', 'fitness', 'gifts'];

export function AddEnvelopeModal({ opened, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: { name: '', budgetShekels: '' },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : t('envelopes.modal.validation.name')),
      budgetShekels: (value) => (Number(value) > 0 ? null : t('envelopes.modal.validation.budget')),
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
      form.reset();
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title={t('envelopes.modal.title')}>
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <div className="flex gap-2">
          {SUGGESTED_CATEGORY_KEYS.map((key) => {
            const label = t(`envelopes.modal.suggested.${key}`);
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                color="gray"
                size="xs"
                onClick={() => form.setFieldValue('name', label)}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <TextInput
          label={t('envelopes.modal.nameLabel')}
          placeholder={t('envelopes.modal.namePlaceholder')}
          required
          {...form.getInputProps('name')}
        />
        <NumberInput
          label={t('envelopes.modal.budgetLabel')}
          placeholder={t('envelopes.modal.budgetPlaceholder')}
          leftSection={t('envelopes.modal.currencySymbol')}
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
            {t('envelopes.modal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
