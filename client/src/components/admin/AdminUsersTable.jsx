import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, EmptyState, Skeleton, Table } from '../ui';
import { getErrorMessage } from '../../utils/errorMessages';
import adminService from '../../services/adminService';

const QUERY_KEY = ['admin-users'];

// Backed by GET/PATCH /api/admin/users (ticket B-08, server-side). Until
// that ships this renders the error state below — expected, not a bug.
export function AdminUsersTable() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState(null);
  const [toggleError, setToggleError] = useState('');

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: adminService.users.list,
  });

  const setDisabledMutation = useMutation({
    mutationFn: ({ id, disabled }) => adminService.users.setDisabled(id, disabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const toggleDisabled = async (targetUser) => {
    if (togglingId) return;
    setToggleError('');
    setTogglingId(targetUser.id);
    try {
      await setDisabledMutation.mutateAsync({ id: targetUser.id, disabled: !targetUser.disabled });
    } catch (err) {
      setToggleError(getErrorMessage(err.message, t));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      {isLoading && (
        <div className="mt-6 flex flex-col gap-2" aria-label={t('admin.users.loading')}>
          <Skeleton height={36} radius="sm" />
          <Skeleton height={36} radius="sm" />
          <Skeleton height={36} radius="sm" />
        </div>
      )}

      {!isLoading && isError && <Alert className="mt-6">{t('admin.users.error')}</Alert>}

      {!isLoading && !isError && toggleError && <Alert className="mt-6">{toggleError}</Alert>}

      {!isLoading && !isError && users.length === 0 && (
        <EmptyState className="mt-16" message={t('admin.users.empty')} />
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="text-start">{t('admin.users.emailHeader')}</Table.Th>
                <Table.Th className="text-start">{t('admin.users.nameHeader')}</Table.Th>
                <Table.Th className="text-start">{t('admin.users.roleHeader')}</Table.Th>
                <Table.Th className="text-start">{t('admin.users.statusHeader')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td className="text-start">{user.email}</Table.Td>
                  <Table.Td className="text-start">{user.full_name}</Table.Td>
                  <Table.Td className="text-start">
                    <Badge color={user.role === 'admin' ? 'accent' : 'gray'}>{user.role}</Badge>
                  </Table.Td>
                  <Table.Td className="text-start">
                    <Badge
                      color={user.disabled ? 'status-danger' : 'status-ok'}
                      className={`cursor-pointer ${togglingId === user.id ? 'opacity-50' : ''}`}
                      onClick={() => toggleDisabled(user)}
                    >
                      {t(user.disabled ? 'admin.users.disabledBadge' : 'admin.users.activeBadge')}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
