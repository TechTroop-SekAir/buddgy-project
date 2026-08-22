import { Checkbox } from './Checkbox';
import { Icon } from './Icon';

// Onboarding's category grid (auth/onboarding visual refresh) needs a card that
// is a *real* checkbox with an accessible name equal to its visible label, so
// e2e/onboarding.spec.js's `getByLabel(label, { exact: true }).check()` keeps
// working unmodified. Mantine's Checkbox.Card renders role="checkbox" with no
// name tied to visible text, so this composes the plain Checkbox adapter (a
// real <input type="checkbox">) instead.
//
// The input is stretched to cover the whole card (opacity-0, absolute
// inset-0) rather than hidden via `sr-only` — a visually-collapsed
// (near-zero-size) input still needs a real hit-test point for Playwright's
// `.check()`/mouse click, and that point landed under the icon chip and
// failed with "element intercepts pointer events". A full-size transparent
// input sitting at a lower z-index than the visible content (which sits in
// its own `relative z-10` wrapper) receives clicks anywhere in the card's
// empty space while letting content above it — like the housing card's
// nested TextInput — remain independently clickable.

// Literal class strings (not templated) so Tailwind's JIT scanner picks them
// up — same requirement as CategoryCard.jsx's ACCENT_CLASSES.
const ACCENT_CLASSES = {
  1: { chip: 'bg-cat-1-tint', icon: 'text-cat-1' },
  2: { chip: 'bg-cat-2-tint', icon: 'text-cat-2' },
  3: { chip: 'bg-cat-3-tint', icon: 'text-cat-3' },
  4: { chip: 'bg-cat-4-tint', icon: 'text-cat-4' },
  5: { chip: 'bg-cat-5-tint', icon: 'text-cat-5' },
  6: { chip: 'bg-cat-6-tint', icon: 'text-cat-6' },
  fallback: { chip: 'bg-cat-fallback-tint', icon: 'text-cat-fallback' },
};

// accentIndex is a 1..6 index into the --cat-N / --cat-N-tint palette
// (src/utils/categoryIcon.js) — pass 0 (or omit) to fall back to
// --cat-fallback / --cat-fallback-tint.
export function SelectableCard({ label, iconName, accentIndex = 0, checked, onChange, children }) {
  const accent = ACCENT_CLASSES[accentIndex] ?? ACCENT_CLASSES.fallback;

  return (
    <label
      className={[
        'group relative flex cursor-pointer flex-col items-start gap-2 rounded-md border p-4',
        'shadow-sm transition-all duration-fast hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-accent',
        checked ? 'border-accent bg-accent-subtle' : 'border-border-card bg-bg-surface',
      ].join(' ')}
    >
      <Checkbox
        checked={checked}
        onChange={onChange}
        aria-label={label}
        classNames={{ root: 'absolute inset-0 z-0', input: 'absolute inset-0 h-full w-full m-0 cursor-pointer opacity-0' }}
      />

      <div className="relative z-10 flex w-full flex-col items-start gap-2">
        <div className="flex w-full items-start justify-between">
          <span className={`flex h-9 w-9 items-center justify-center rounded-md ${accent.chip}`}>
            <Icon name={iconName} size="md" className={accent.icon} />
          </span>
          {checked && (
            <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-accent">
              <Icon name="check" size="xs" className="text-bg-surface" />
            </span>
          )}
        </div>

        <span className="text-sm font-medium text-text-primary">{label}</span>

        {children}
      </div>
    </label>
  );
}
