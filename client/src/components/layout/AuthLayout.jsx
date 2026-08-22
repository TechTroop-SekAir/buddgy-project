import { useTranslation } from 'react-i18next';
import { Icon } from '../ui';
import buddgyLogoHorizontal from '../../assets/logo/buddgy-logo-horizontal.svg';

// Shared shell for /login and /register. All auth form state, validation,
// and submit handling stays in the page components — this only owns the
// brand panel and the responsive split-screen/centered-card layout.
//
// lg+: a two-column grid — a decorative bg-brand-gradient-strong panel with
// the logo lockup, tagline, and value props start-side, the form column
// end-side. Below lg: the brand panel is hidden and the form sits inside a
// bordered/shadowed card with a compact logo lockup and a brand-stripe top
// edge instead, so mobile still reads as "designed," not "collapsed."
//
// Uses only logical properties (grid/gap/text-start) so this flips correctly
// under dir="rtl" with zero component-level RTL branching.
const VALUE_PROP_KEYS = ['envelopes', 'ai', 'calendar'];

function LogoMark({ size = 'sm' }) {
  const boxClass = size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  const iconSize = size === 'lg' ? 'md' : 'sm';
  return (
    <span className={`flex ${boxClass} shrink-0 items-center justify-center rounded-md bg-brand-gradient`}>
      <Icon name="wallet" size={iconSize} className="text-bg-surface" />
    </span>
  );
}

export function AuthLayout({ title, subtitle, children, footer }) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen bg-bg-page lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <div className="hidden flex-col justify-center gap-8 bg-brand-gradient-strong px-12 py-9 text-bg-surface lg:flex">
        {/* Baked SVG wordmark (client/src/assets/logo/) — Latin "BUDDGY" +
            "Your Budget Buddy", vector outlines of Mulish Black Italic /
            SemiBold, white-on-transparent. Deliberately scoped to this
            English-language marketing panel only: he.json's
            common.appName is a Hebrew transliteration ("באדג'י"), not
            Latin "Buddgy", so this image can't stand in for the live
            translated wordmark used in AppHeader/OnboardingPage/the
            mobile card lockup below — those keep the text-based LogoMark. */}
        <img src={buddgyLogoHorizontal} alt={t('common.appName')} className="h-9 w-auto" />

        <p className="max-w-sm text-lg font-medium leading-snug">{t('auth.brand.tagline')}</p>

        <ul className="flex flex-col gap-3">
          {VALUE_PROP_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-3 opacity-90">
              <Icon name="check" size="sm" />
              <span className="text-sm">{t(`auth.brand.points.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Form column */}
      <div className="flex items-center justify-center px-8 py-9">
        <div className="w-full max-w-md overflow-hidden rounded-lg border border-border-card bg-bg-surface shadow-md lg:border-0 lg:bg-transparent lg:shadow-none">
          <div className="h-0.5 w-full bg-brand-stripe lg:hidden" />
          <div className="px-6 py-5 lg:px-0 lg:py-0">
            <div className="mb-7 flex items-center gap-2.5 lg:hidden">
              <LogoMark />
              <span className="text-base font-semibold tracking-tight text-text-primary">
                {t('common.appName')}
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{title}</h1>
            {subtitle && <p className="mt-1 text-base text-text-secondary">{subtitle}</p>}

            <div className="mt-7">{children}</div>

            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
