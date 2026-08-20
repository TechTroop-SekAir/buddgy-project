import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../components/ui';
import { AdminUsersTable } from '../components/admin/AdminUsersTable';
import { AdminStatsCards } from '../components/admin/AdminStatsCards';

export function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t('admin.title')}</h1>

      <Tabs value={activeTab} onChange={setActiveTab} className="mt-6">
        <Tabs.List>
          <Tabs.Tab value="users">{t('admin.tabs.users')}</Tabs.Tab>
          <Tabs.Tab value="stats">{t('admin.tabs.stats')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="users">
          <AdminUsersTable />
        </Tabs.Panel>
        <Tabs.Panel value="stats">
          <AdminStatsCards />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
