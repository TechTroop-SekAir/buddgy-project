import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { ActionIcon, Button, Icon, Menu } from '../ui';
import { ProfileMenu } from './ProfileMenu';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useMonth } from '../../context/MonthContext';
import { getCurrentMonth } from '../../utils/month';
import { getMonthLabel } from '../../utils/date';

// Sticky app header shared by every protected page (see routes.jsx's layout
// route). Nav items reuse react-router's NavLink so "active" state is
// derived from the URL rather than local state — see
// docs/DASHBOARD-REDESIGN.md Step 5.
const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: 'layoutDashboard' },
  { to: '/transactions', labelKey: 'nav.transactions', icon: 'arrowLeftRight' },
  { to: '/planned-expenses', labelKey: 'nav.plannedExpenses', icon: 'calendarDays' },
  { to: '/imports', labelKey: 'nav.imports', icon: 'upload' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings' },
];

function navLinkClass({ isActive }) {
  return [
    'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors duration-fast',
    isActive
      ? 'bg-bg-subtle font-medium text-text-primary'
      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  ].join(' ');
}

export function AppHeader() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { direction } = useLocale();
  const { month, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonth();
  const items = user.role === 'admin' ? [...NAV_ITEMS, { to: '/admin', labelKey: 'nav.admin', icon: 'barChart3' }] : NAV_ITEMS;
  const monthLabel = getMonthLabel(month);
  const isCurrentMonth = month === getCurrentMonth();
  // "previous" must point toward the start of reading order, which flips
  // with RTL — same reasoning as MonthNavigator.jsx.
  const prevIcon = direction === 'rtl' ? 'chevronRight' : 'chevronLeft';
  const nextIcon = direction === 'rtl' ? 'chevronLeft' : 'chevronRight';

  return (
    <header className="sticky top-0 z-40 border-b border-border-nav bg-bg-surface">
      <div className="h-0.5 w-full bg-brand-stripe" />
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between gap-6 px-6">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-brand-gradient">
            <Icon name="wallet" size="sm" className="text-bg-surface" />
          </span>
          <span className="text-base font-semibold tracking-tight text-text-primary">{t('common.appName')}</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
          {items.map(({ to, labelKey, icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon name={icon} size="sm" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded-sm border border-border-card px-1.5 py-1 text-sm text-text-secondary sm:flex">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={goToPreviousMonth}
              aria-label={t('monthNavigator.prev')}
            >
              <Icon name={prevIcon} size="xs" />
            </ActionIcon>
            <Icon name="calendarDays" size="xs" className="text-text-muted" />
            <span className="font-medium">{monthLabel}</span>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={goToNextMonth}
              aria-label={t('monthNavigator.next')}
            >
              <Icon name={nextIcon} size="xs" />
            </ActionIcon>
            {!isCurrentMonth && (
              <Button variant="subtle" color="accent" size="xs" className="ms-1" onClick={goToCurrentMonth}>
                {t('monthNavigator.currentMonth')}
              </Button>
            )}
          </span>

          <div className="md:hidden">
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" aria-label={t('nav.menu')}>
                  <Icon name="menu" size="sm" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {items.map(({ to, labelKey, icon }) => (
                  <Menu.Item key={to} component={Link} to={to} leftSection={<Icon name={icon} size="sm" />}>
                    {t(labelKey)}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </div>

          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
