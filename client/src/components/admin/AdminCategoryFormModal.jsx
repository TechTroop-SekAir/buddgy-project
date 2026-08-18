import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal, TextInput } from '../ui';
import { getErrorMessage } from '../../utils/errorMessages';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// Single reusable form for both create and edit — mode is inferred from
// whether `category` is passed, same pattern as
// components/categories/CategoryFormModal.jsx. `is_active` is not a form
// field here; it's toggled from the table row (see AdminCategoriesTable),
// matching the docs/API.md PUT semantics for retiring a category.
export function AdminCategoryFormModal({ opened, category = null, onClose, onSubmit }) {
  const { t } = useTranslation();
  const isEdit = category != null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm({
    initialValues: {
      nameHe: category?.name_he ?? '',
      nameEn: category?.name_en ?? '',
      color: category?.color ?? '',
    },
    validate: {
      nameHe: (value) =>
        value.trim().length > 0 && value.trim().length <= 80 ? null : t('adminCategoryModal.nameHeRequired'),
      nameEn: (value) =>
        value.trim().length > 0 && value.trim().length <= 80 ? null : t('adminCategoryModal.nameEnRequired'),
      color: (value) => (value.trim() === '' || HEX_COLOR_REGEX.test(value.trim()) ? null : t('adminCategoryModal.colorInvalid')),
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
      const payload = {
        name_he: values.nameHe.trim(),
        name_en: values.nameEn.trim(),
      };
      if (values.color.trim() !== '') {
        payload.color = values.color.trim();
      }
      await onSubmit(payload);
      form.reset();
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t(isEdit ? 'adminCategoryModal.editTitle' : 'adminCategoryModal.addTitle')}
    >
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <TextInput
          id={isEdit ? 'admin-category-edit-name-he' : 'admin-category-name-he'}
          name="nameHe"
          autoComplete="off"
          label={t('adminCategoryModal.nameHeLabel')}
          placeholder={t('adminCategoryModal.nameHePlaceholder')}
          required
          {...form.getInputProps('nameHe')}
        />
        <TextInput
          id={isEdit ? 'admin-category-edit-name-en' : 'admin-category-name-en'}
          name="nameEn"
          autoComplete="off"
          label={t('adminCategoryModal.nameEnLabel')}
          placeholder={t('adminCategoryModal.nameEnPlaceholder')}
          required
          {...form.getInputProps('nameEn')}
        />
        <TextInput
          id={isEdit ? 'admin-category-edit-color' : 'admin-category-color'}
          name="color"
          autoComplete="off"
          label={t('adminCategoryModal.colorLabel')}
          placeholder={t('adminCategoryModal.colorPlaceholder')}
          {...form.getInputProps('color')}
        />
        {submitError && <Alert>{submitError}</Alert>}
        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="outline" color="gray" onClick={handleClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="filled" color="accent" loading={isSubmitting}>
            {t(isEdit ? 'adminCategoryModal.submitEdit' : 'adminCategoryModal.submitAdd')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
