import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Burger, Button, Drawer } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

const NAV_LINKS = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/transactions', key: 'nav.transactions' },
  { to: '/planned-expenses', key: 'nav.plannedExpenses' },
  { to: '/imports', key: 'nav.imports' },
  { to: '/settings', key: 'nav.settings' },
];

// The one shared site-chrome header, rendered at the top of every
// authenticated page — replaces each page's previously duplicated
// title/links/logout row (see client/CLAUDE.md § Structure & Naming, "no
// direct duplication of cross-page concerns"). Pages keep their own <h1> +
// primary action button below this.
export function PageHeader() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { direction } = useLocale();
  const [drawerOpened, setDrawerOpened] = useState(false);

  const links = user?.role === 'admin' ? [...NAV_LINKS, { to: '/admin', key: 'nav.admin' }] : NAV_LINKS;

  return (
    <header className="border-b border-border-nav bg-bg-surface">
      {/* Desktop (md:+): standard horizontal nav bar */}
      <div className="hidden md:flex items-center justify-between px-8 py-5">
        <Link to="/dashboard" className="text-2xl font-semibold text-text-primary">
          {t('common.appName')}
        </Link>
        <div className="flex items-center gap-4">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="text-sm text-text-secondary hover:text-text-primary">
              {t(link.key)}
            </Link>
          ))}
          <Button variant="outline" color="gray" size="md" onClick={logout}>
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      {/* Mobile (< md:): burger + logo at the start, logout stays visible at the end */}
      <div className="flex md:hidden items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <Burger
            opened={drawerOpened}
            onClick={() => setDrawerOpened((opened) => !opened)}
            aria-label={t('nav.menu')}
            size="sm"
          />
          <Link to="/dashboard" className="text-xl font-semibold text-text-primary">
            {t('common.appName')}
          </Link>
        </div>
        <Button variant="outline" color="gray" size="md" onClick={logout}>
          {t('nav.logout')}
        </Button>
      </div>

      {/* Drawer opens from the reading-start edge — right in RTL/Hebrew, left
          in LTR. Counterintuitively, Mantine's Drawer positions via plain
          `justify-content: flex-start/flex-end` with no [dir] override
          (@mantine/core/styles/Drawer.css), which is direction-relative
          under html[dir="rtl"] — so `position="right"` (flex-end) actually
          renders on the physical LEFT under rtl, and `position="left"`
          (flex-start) renders on the physical RIGHT. Pass the literal
          opposite of the visual side you want. */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        position={direction === 'rtl' ? 'left' : 'right'}
        title={t('nav.menu')}
      >
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setDrawerOpened(false)}
              className="px-3 py-3 rounded-md text-base text-text-primary hover:bg-bg-page"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
      </Drawer>
    </header>
  );
}
