import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import adminService from '../../services/adminService';

const STAT_KEYS = ['userCount', 'transactionCount', 'aiCallCount'];

// Backed by GET /api/admin/stats (ticket B-08, server-side). Until that
// ships this renders the error state below — expected, not a bug.
export function AdminStatsCards() {
  const { t } = useTranslation();

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.stats.get,
  });

  if (isLoading) {
    return <p className="text-text-secondary mt-6">{t('admin.stats.loading')}</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-form-error mt-6" role="alert">
        {t('admin.stats.error')}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      {STAT_KEYS.map((key) => (
        <Card key={key} className="bg-bg-surface border border-border-card rounded-lg px-6 py-5">
          <p className="text-sm text-text-secondary">{t(`admin.stats.${key}`)}</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{stats?.[key] ?? 0}</p>
        </Card>
      ))}
    </div>
  );
}
