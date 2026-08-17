import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Modal, Table } from '../ui';
import { AdminCategoryFormModal } from './AdminCategoryFormModal';
import { getErrorMessage } from '../../utils/errorMessages';
import adminService from '../../services/adminService';

const QUERY_KEY = ['admin-categories'];

export function AdminCategoriesTable() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: adminService.categories.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: (payload) => adminService.categories.create(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminService.categories.update(id, payload),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id) => adminService.categories.remove(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  const openEdit = (category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
  };

  const handleFormSubmit = (payload) => {
    if (editingCategory) {
      return updateMutation.mutateAsync({ id: editingCategory.id, payload });
    }
    return createMutation.mutateAsync(payload);
  };

  const toggleActive = (category) => {
    updateMutation.mutate({ id: category.id, payload: { is_active: !category.is_active } });
  };

  const openDeleteConfirm = (category) => {
    setDeleteError('');
    setDeletingCategory(category);
  };

  const cancelDelete = () => {
    setDeleteError('');
    setDeletingCategory(null);
  };

  const confirmDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await removeMutation.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err.message, t));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end">
        <Button variant="filled" color="accent" onClick={openCreate}>
          {t('admin.categories.addButton')}
        </Button>
      </div>

      {isLoading && <p className="text-text-secondary mt-6">{t('admin.categories.loading')}</p>}

      {!isLoading && isError && (
        <p className="text-sm text-form-error mt-6" role="alert">
          {t('admin.categories.error')}
        </p>
      )}

      {!isLoading && !isError && categories.length === 0 && (
        <p className="text-text-secondary text-center mt-16">{t('admin.categories.empty')}</p>
      )}

      {!isLoading && !isError && categories.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="text-start">{t('admin.categories.nameHeHeader')}</Table.Th>
                <Table.Th className="text-start">{t('admin.categories.nameEnHeader')}</Table.Th>
                <Table.Th className="text-start">{t('admin.categories.colorHeader')}</Table.Th>
                <Table.Th className="text-start">{t('admin.categories.statusHeader')}</Table.Th>
                <Table.Th className="text-end">{t('admin.categories.actionsHeader')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categories.map((category) => (
                <Table.Tr key={category.id}>
                  <Table.Td className="text-start">{category.name_he}</Table.Td>
                  <Table.Td className="text-start">{category.name_en}</Table.Td>
                  <Table.Td className="text-start">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-border-card"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-text-secondary">{category.color}</span>
                    </div>
                  </Table.Td>
                  <Table.Td className="text-start">
                    <Badge
                      color={category.is_active ? 'status-ok' : 'gray'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(category)}
                    >
                      {t(category.is_active ? 'admin.categories.activeBadge' : 'admin.categories.inactiveBadge')}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="text-end">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" color="gray" size="xs" onClick={() => openEdit(category)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="outline"
                        color="status-danger"
                        size="xs"
                        onClick={() => openDeleteConfirm(category)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}

      <AdminCategoryFormModal
        opened={isFormOpen}
        category={editingCategory}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
      />

      <Modal
        opened={deletingCategory != null}
        onClose={cancelDelete}
        title={t('admin.categories.deleteConfirmTitle')}
      >
        <p className="text-sm text-text-secondary mb-6">
          {t('admin.categories.deleteConfirmBody', { name: deletingCategory?.name_en })}
        </p>
        {deleteError && (
          <p className="text-sm text-form-error mb-4" role="alert">
            {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" color="gray" onClick={cancelDelete} disabled={isDeleting}>
            {t('common.cancel')}
          </Button>
          <Button color="status-danger" onClick={confirmDelete} loading={isDeleting}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
