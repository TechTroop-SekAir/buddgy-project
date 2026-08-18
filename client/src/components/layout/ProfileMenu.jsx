import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActionIcon, Menu } from '../ui';
import { useAuth } from '../../context/AuthContext';

// Split out of AppHeader for readability — see docs/DASHBOARD-REDESIGN.md
// Step 5. Uses the Menu/ActionIcon adapters so the dropdown gets Escape
// handling, outside-click, focus return, and RTL-aware placement for free
// (client/CLAUDE.md § Component Boundary — no raw <button> in a page).
export function ProfileMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const initial = (user.full_name || user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          radius="pill"
          size="lg"
          aria-label={t('nav.profileMenu')}
          className="bg-brand-gradient-strong text-xs font-semibold text-bg-surface"
        >
          {initial}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <p className="text-sm font-semibold text-text-strong">{user.full_name || user.email}</p>
          {user.full_name && <p className="text-xs text-text-muted">{user.email}</p>}
        </Menu.Label>
        <Menu.Item component={Link} to="/settings">
          {t('nav.settings')}
        </Menu.Item>
        <Menu.Item component={Link} to="/imports">
          {t('nav.imports')}
        </Menu.Item>
        {user.role === 'admin' && (
          <Menu.Item component={Link} to="/admin">
            {t('nav.admin')}
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item color="status-danger" onClick={logout}>
          {t('nav.logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
