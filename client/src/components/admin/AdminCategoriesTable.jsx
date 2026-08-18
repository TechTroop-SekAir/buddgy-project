import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, EmptyState, Skeleton, Table } from '../ui';
import { AdminCategoryFormModal } from './AdminCategoryFormModal';
import { ConfirmDeleteModal } from '../shared/ConfirmDeleteModal';
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
  const [togglingId, setTogglingId] = useState(null);
  const [toggleError, setToggleError] = useState('');

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

  const toggleActive = async (category) => {
    if (togglingId) return;
    setToggleError('');
    setTogglingId(category.id);
    try {
      await updateMutation.mutateAsync({ id: category.id, payload: { is_active: !category.is_active } });
    } catch (err) {
      setToggleError(getErrorMessage(err.message, t));
    } finally {
      setTogglingId(null);
    }
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

      {isLoading && (
        <div className="mt-6 flex flex-col gap-2" aria-label={t('admin.categories.loading')}>
          <Skeleton height={36} radius="sm" />
          <Skeleton height={36} radius="sm" />
          <Skeleton height={36} radius="sm" />
        </div>
      )}

      {!isLoading && isError && <Alert className="mt-6">{t('admin.categories.error')}</Alert>}

      {!isLoading && !isError && toggleError && <Alert className="mt-6">{toggleError}</Alert>}

      {!isLoading && !isError && categories.length === 0 && (
        <EmptyState className="mt-16" message={t('admin.categories.empty')} />
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
                      className={`cursor-pointer ${togglingId === category.id ? 'opacity-50' : ''}`}
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

      <ConfirmDeleteModal
        opened={deletingCategory != null}
        title={t('admin.categories.deleteConfirmTitle')}
        body={t('admin.categories.deleteConfirmBody', { name: deletingCategory?.name_en })}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
