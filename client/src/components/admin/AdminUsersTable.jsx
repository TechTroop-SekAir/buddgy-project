import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Table } from '../ui';
import adminService from '../../services/adminService';

const QUERY_KEY = ['admin-users'];

// Backed by GET/PATCH /api/admin/users (ticket B-08, server-side). Until
// that ships this renders the error state below — expected, not a bug.
export function AdminUsersTable() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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

  return (
    <div>
      {isLoading && <p className="text-text-secondary mt-6">{t('admin.users.loading')}</p>}

      {!isLoading && isError && (
        <p className="text-sm text-form-error mt-6" role="alert">
          {t('admin.users.error')}
        </p>
      )}

      {!isLoading && !isError && users.length === 0 && (
        <p className="text-text-secondary text-center mt-16">{t('admin.users.empty')}</p>
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
                      className="cursor-pointer"
                      onClick={() => setDisabledMutation.mutate({ id: user.id, disabled: !user.disabled })}
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
