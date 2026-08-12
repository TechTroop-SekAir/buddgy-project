import { useState } from 'react';
import { useForm } from '@mantine/form';
import { Button, Modal, NumberInput, TextInput } from '../ui';
import { shekelsToAgorot } from '../../utils/money';

const SUGGESTED_CATEGORIES = ['Pets', 'Fitness', 'Gifts'];

export function AddEnvelopeModal({ opened, onClose, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: { name: '', budgetShekels: '' },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : 'Name is required'),
      budgetShekels: (value) => (Number(value) > 0 ? null : 'Budget must be greater than 0'),
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
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add envelope">
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <div className="flex gap-2">
          {SUGGESTED_CATEGORIES.map((category) => (
            <Button
              key={category}
              type="button"
              variant="outline"
              color="gray"
              size="xs"
              onClick={() => form.setFieldValue('name', category)}
            >
              {category}
            </Button>
          ))}
        </div>
        <TextInput label="Name" placeholder="e.g. Groceries" required {...form.getInputProps('name')} />
        <NumberInput
          label="Monthly budget"
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
            Cancel
          </Button>
          <Button type="submit" variant="filled" color="accent" loading={isSubmitting}>
            Add Envelope
          </Button>
        </div>
      </form>
    </Modal>
  );
}
