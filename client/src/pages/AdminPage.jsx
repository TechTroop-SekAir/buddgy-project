import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../components/ui';
import { AdminCategoriesTable } from '../components/admin/AdminCategoriesTable';
import { AdminUsersTable } from '../components/admin/AdminUsersTable';
import { AdminStatsCards } from '../components/admin/AdminStatsCards';
import { PageHeader } from '../components/shared/PageHeader';

export function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <>
      <PageHeader />
      <div className="p-8">
      <h1 className="text-2xl font-semibold text-text-primary">{t('admin.title')}</h1>

      <Tabs value={activeTab} onChange={setActiveTab} className="mt-6">
        <Tabs.List>
          <Tabs.Tab value="categories">{t('admin.tabs.categories')}</Tabs.Tab>
          <Tabs.Tab value="users">{t('admin.tabs.users')}</Tabs.Tab>
          <Tabs.Tab value="stats">{t('admin.tabs.stats')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories">
          <AdminCategoriesTable />
        </Tabs.Panel>
        <Tabs.Panel value="users">
          <AdminUsersTable />
        </Tabs.Panel>
        <Tabs.Panel value="stats">
          <AdminStatsCards />
        </Tabs.Panel>
      </Tabs>
      </div>
    </>
  );
}
