import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal, NumberInput, TextInput } from '../ui';
import { agorotToShekels, shekelsToAgorot } from '../../utils/money';
import { getErrorMessage } from '../../utils/errorMessages';

const SUGGESTED_CATEGORY_KEYS = ['pets', 'fitness', 'gifts'];

// Single reusable form for both create and edit — mode is inferred from
// whether `category` is passed, rather than maintaining two near-identical
// modal components.
export function CategoryFormModal({ opened, category = null, onClose, onSubmit }) {
  const { t } = useTranslation();
  const isEdit = category != null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: {
      name: category?.name ?? '',
      budgetShekels: category ? String(agorotToShekels(category.monthly_budget_agorot)) : '',
    },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : t('addCategoryModal.nameRequired')),
      budgetShekels: (value) => (Number(value) > 0 ? null : t('addCategoryModal.budgetInvalid')),
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
      // Field-level, not the generic Alert below — the user's fix is
      // right there on the name input (docs/features/HOMEPAGE-FIXES.md § 3.4).
      if (err.message === 'duplicate: name') {
        form.setFieldError('name', t('addCategoryModal.nameDuplicate'));
      } else {
        setSubmitError(getErrorMessage(err.message, t));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t(isEdit ? 'editCategoryModal.title' : 'addCategoryModal.title')}
    >
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        {!isEdit && (
          <div className="flex gap-2">
            {SUGGESTED_CATEGORY_KEYS.map((key) => {
              const label = t(`addCategoryModal.suggestedCategories.${key}`);
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
        )}
        <TextInput
          id={isEdit ? 'category-edit-name' : 'category-name'}
          name="name"
          autoComplete="off"
          label={t('addCategoryModal.nameLabel')}
          placeholder={t('addCategoryModal.namePlaceholder')}
          required
          {...form.getInputProps('name')}
        />
        <NumberInput
          id={isEdit ? 'category-edit-budget' : 'category-budget'}
          name="monthlyBudget"
          autoComplete="off"
          label={t('addCategoryModal.budgetLabel')}
          placeholder="0"
          leftSection="₪"
          min={0}
          required
          // Editing an existing category: select the prefilled amount on
          // focus so typing replaces it outright instead of appending to it
          // (docs/features/HOMEPAGE-FIXES.md § 3.1).
          onFocus={isEdit ? (event) => event.target.select() : undefined}
          {...form.getInputProps('budgetShekels')}
        />
        {submitError && <Alert>{submitError}</Alert>}
        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="outline" color="gray" onClick={handleClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="filled" color="accent" loading={isSubmitting}>
            {t(isEdit ? 'editCategoryModal.submit' : 'addCategoryModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
