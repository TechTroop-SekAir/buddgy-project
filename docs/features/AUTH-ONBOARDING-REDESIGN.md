# Buddgy — Auth & Onboarding Visual Refactor

## Context

`docs/DASHBOARD-REDESIGN.md` already brought the `docs/design-ref/` visual language into the app:
rounded cards with slate-tinted shadows, tinted `--cat-N` icon chips, a sticky header with a
`--brand-stripe` accent, a gradient logo lockup, and a token-only palette. That work covered the
dashboard and the app shell. It never touched the three screens a user actually sees *first*.

`LoginPage.jsx`, `RegisterPage.jsx`, and `OnboardingPage.jsx` still render the Day-1 styling: a
bare centered `rounded-lg` card on a flat page, no brand mark, no gradient, no illustration, and —
in onboarding — an eleven-row column of plain checkboxes. Against the redesigned dashboard behind
them, the first-run experience reads as a different, older product.

This plan applies the established design language to those screens. **No data-layer, API, routing,
or form-validation change** — every `authService` call, `useForm` validator, mutation, and
navigation target stays exactly as it is. The existing Playwright specs must pass unmodified.

**Confirmed with the user during planning:**
- Auth pages get a **split-screen brand panel** (gradient panel + form card, collapsing to the
  centered card on mobile).
- `RegisterPage` is included — a shared `AuthLayout` serves both.
- The onboarding category step becomes a **selectable icon-card grid**, not a checkbox column.

---

## Step 1 — Design-system additions

These are the only new primitives; everything else composes existing tokens.

### 1.1 `client/src/components/ui/Icon.jsx` — registry + one size

Add to `ICON_REGISTRY` (lucide-react is already a dependency; this file is the only module allowed
to import it):

| Key | lucide component | Used by |
|---|---|---|
| `mail` | `Mail` | auth email field icon |
| `lock` | `Lock` | auth password field icon |
| `eye` / `eyeOff` | `Eye` / `EyeOff` | password visibility toggle |
| `shield` | `ShieldCheck` | onboarding `insurance` |
| `creditCard` | `CreditCard` | onboarding `debtsAndLoans` |
| `partyPopper` | `PartyPopper` | onboarding `events` |
| `plane` | `Plane` | onboarding `vacations` |

Add `xl: 22` to `SIZES`. Do **not** add these to `MIRROR_IN_RTL` — none carry left/right meaning.

### 1.2 `client/src/components/ui/SelectableCard.jsx` — new adapter + barrel export

The category grid needs a card that is a *real* checkbox. `Mantine`'s `Checkbox.Card` renders
`role="checkbox"` with a content-derived name, which `e2e/onboarding.spec.js:33` (`getByLabel(...)
.check()`) cannot target. So compose instead:

```jsx
<label className="group relative flex cursor-pointer flex-col items-start gap-2 rounded-md
                  border border-border-card bg-bg-surface p-4 shadow-sm transition-all
                  duration-fast hover:shadow-md focus-within:ring-2 focus-within:ring-accent
                  [&:has(:checked)]:border-accent [&:has(:checked)]:bg-accent-subtle">
  <Checkbox checked={checked} onChange={onChange} aria-label={label} className="sr-only" />
  … tinted icon chip, label text, check badge when selected …
</label>
```

Key points:
- The real `<input>` stays in the accessibility tree with an accessible name equal to `label`, so
  the existing spec keeps working. Tailwind's built-in `sr-only` hides it visually.
- The wrapping `<label>` makes the entire card clickable and keyboard-operable via the input.
- Focus ring lives on the card (`focus-within:`), satisfying `.claude/commands/design.md` § 8.
- Props: `{ label, iconName, accentIndex, checked, onChange }`. The icon chip uses
  `bg-cat-{n}-tint` / `text-cat-{n}` — the same deterministic palette `CategoryCard` uses.
- Selection is signalled by border + tint + a check badge, never color alone (`docs/DESIGN.md`).

Export from `client/src/components/ui/index.js`.

### 1.3 No new CSS tokens

Everything needed already exists: `--brand-gradient-strong` (mandatory wherever the gradient
carries text — the plain gradient fails AA), `--brand-stripe`, `--cat-1..6` + tints,
`--radius-md/lg`, `--shadow-sm/md/lg`, `--duration-fast`.

Two traps to respect:
- **`shadow-xl` is not a token.** Tailwind's stock black `shadow-xl` would leak in — use
  `shadow-lg`.
- **Color tokens are bare `var()`s with no `<alpha-value>`**, so `text-bg-surface/80` emits invalid
  CSS. For the muted copy on the gradient panel, use the `opacity-*` utility on the element
  instead.

---

## Step 2 — `AuthLayout` (new shared component)

New file `client/src/components/layout/AuthLayout.jsx`. Props: `{ title, subtitle, children,
footer }`.

```
lg and up                                    below lg
┌────────────────────┬──────────────────┐    ┌──────────────────┐
│ bg-brand-gradient- │                  │    │  [◈] Buddgy      │
│ strong             │   <title>        │    │                  │
│  [◈] Buddgy        │   <subtitle>     │    │  <title>         │
│  tagline           │   ────────────   │    │  <subtitle>      │
│  ✓ value prop ×3   │   {children}     │    │  {children}      │
│                    │   {footer}       │    │  {footer}        │
└────────────────────┴──────────────────┘    └──────────────────┘
```

- Root: `grid min-h-screen lg:grid-cols-2 bg-bg-page`.
- **Brand panel** (`hidden lg:flex`): `bg-brand-gradient-strong`, flex column, centered content,
  generous padding. Contains the same logo lockup as `AppHeader.jsx:68-73` (7×7 → 10×10
  `rounded-md` mark with `Icon name="wallet"`, wordmark from `t('common.appName')`), a tagline, and
  three value props each rendered as `Icon name="check"` + text. All text `text-bg-surface`, the
  supporting copy at `opacity-80`.
- **Form column**: centered, `w-full max-w-md`, `px-8 py-9` (the page-body spacing from
  `design.md` § 6). On `lg+` the form sits directly on `bg-bg-page` (the gradient panel supplies
  the visual weight); below `lg` it is wrapped in a `bg-bg-surface border border-border-card
  rounded-lg shadow-md` card carrying a `bg-brand-stripe` top edge and the compact logo lockup, so
  the mobile view is the "polished centered card" and the desktop view is the split screen.
- `<h1 className="text-3xl font-semibold tracking-tight text-text-primary">` — one per page.
- Uses only logical properties; the grid, `gap`, and `text-start` all flip correctly under
  `dir="rtl"` with no code change.

---

## Step 3 — `LoginPage.jsx` and `RegisterPage.jsx`

Both become thin bodies inside `AuthLayout`. **All form state, validators, `authService` calls,
`login({token,user})`, and `navigate('/dashboard')` stay byte-identical.** Only markup changes.

- Wrap the existing `<form>` in `<AuthLayout title={t('auth.login.title')} subtitle={…} footer={…}>`.
- `TextInput`s gain `leftSection={<Icon name="mail" size="sm" />}` / `name="lock"`. **Keep the
  `label` prop** — `e2e/auth.setup.js`, `auth.spec.js`, and `onboarding.spec.js` all locate fields
  via `getByLabel(t.auth.emailLabel)`; placeholder-only labels are also banned by `design.md` § 3.
- Password fields get a visibility toggle: `rightSection` with an `ActionIcon` swapping
  `eye`/`eyeOff` and toggling `type` between `password` and `text`. `aria-label` required
  (icon-only button); add locale keys.
- Submit `Button` becomes **full width** (`className="mt-6 w-full"`) and `size="lg"` — `design.md`
  § 8 notes `size="md"` renders at 42px, short of the 44px touch target, and `lg` is the first size
  that clears it. Keep `loading={isSubmitting}`.
- Replace the hand-rolled `<p className="text-sm text-form-error" role="alert">` with the `Alert`
  adapter. `Alert.jsx` renders exactly `<p role="alert" className="text-sm text-form-error">`, so
  this is output-identical and removes the last hand-rolled error markup on these pages.
- Footer link row moves into `AuthLayout`'s `footer` slot, unchanged in wording.

---

## Step 4 — `OnboardingPage.jsx`

Shell only — `onboardingMutation`, its sequential income→categories→`completeOnboarding` order, its
three `invalidateQueries` calls, and `navigate('/dashboard', { replace: true })` are untouched.

- Root becomes `min-h-screen bg-bg-page`, with a slim top bar carrying `bg-brand-stripe` and the
  logo lockup (matching `AppHeader`), since `/onboarding` renders outside `AppShellLayout` and
  currently has no chrome at all (`routes.jsx:91-98`).
- Content column widens `max-w-2xl` → `max-w-3xl` to fit the three-column card grid.
- Heading block: keep `h1` + subtitle, add a `text-sm text-text-muted` step counter
  ("Step 1 of 2") beside the `Stepper`. New locale key.
- The step card becomes `rounded-lg border border-border-card bg-bg-surface p-6 shadow-md` with a
  `fade-up`-style entrance — add a keyframe to `client/src/index.css`'s `@layer utilities` (the
  reference's `index.css.md` defines exactly this animation; it is currently the one piece of the
  design-ref not yet adopted). Respect `prefers-reduced-motion`.

## Step 5 — `IncomeStep.jsx`

Props and emitted shape (`[{ label, amount_agorot }]`) unchanged.

- Each income row becomes a bordered `rounded-md border border-border-card bg-bg-hover p-3` row
  rather than three bare fields, with the remove `ActionIcon` aligned to the row end.
- The total card is promoted: `bg-accent-subtle border-accent`, `Icon name="trendingUp"` chip, and
  the figure at `text-2xl` keeping `font-mono num-tabular` (the tabular-nums class from the
  previous phase).
- `Button` sizes bumped to `lg` for the touch-target rule; Continue gets
  `Icon name="chevronRight"` (already in `MIRROR_IN_RTL`, so it flips correctly under Hebrew).

## Step 6 — `CategoriesStep.jsx`

Props (`onBack`, `onFinish`, `isSubmitting`, `submitError`) and the emitted `[{ name }]` shape
unchanged. `selected`/`housingCustomLabel` state and `handleFinish` unchanged.

- Add a module-level `CATEGORY_META` map keyed by the **stable English keys** already in the file
  (`housing`, `utilities`, …), not by the localized label — `getCategoryIconName()` in
  `client/src/utils/categoryIcon.js` looks up English names and would return `wallet` for all
  eleven Hebrew labels. Each entry: `{ icon, accent }` drawn from the `--cat-1..6` palette.

  ```
  housing → home/5      utilities → zap/3        transport → car/4
  insurance → shield/1  dailyLiving → shoppingCart/1  selfCare → sparkles/3
  debtsAndLoans → creditCard/2  savings → piggyBank/6  events → partyPopper/5
  vacations → plane/1   general → wallet/fallback
  ```

- Replace the `flex flex-col gap-2` checkbox column with
  `grid grid-cols-2 gap-3 sm:grid-cols-3` of `SelectableCard`s.
- The housing custom-name `TextInput` moves *inside* the housing card (rendered below the label
  when selected), stopping click-propagation so typing doesn't toggle the card.
- Header row above the grid: a live "N selected" count on one side, the existing
  select-all/deselect-all control on the other, promoted from a `Checkbox` to a
  `Button variant="subtle"`. New locale key for the count (with i18next pluralization).
- `submitError` keeps rendering through the `Alert` adapter, unchanged.
- Footer buttons to `size="lg"`, Finish gains `Icon name="check"`.

## Step 7 — i18n

Every new string lands in **both** `client/src/locales/he.json` and `en.json` in the same edit
(`client/CLAUDE.md` § i18n). New keys:

- `auth.brand.tagline`, `auth.brand.points.envelopes`, `auth.brand.points.ai`,
  `auth.brand.points.calendar`
- `auth.login.subtitle`, `auth.register.subtitle`
- `auth.showPassword`, `auth.hidePassword`
- `onboarding.stepCounter` (interpolated `{{current}}`/`{{total}}`)
- `onboarding.categories.selectedCount` (pluralized `_one`/`_other` in `en`, `_one`/`_two`/`_many`/
  `_other` in `he`)

While here, either wire up or delete the two dead keys
`onboarding.income.defaultRows.secondarySalary` / `.stipend` — defined in both files, referenced
nowhere. Recommendation: delete; `IncomeStep` lets the user type any label.

---

## Files touched

| File | Change |
|---|---|
| `client/src/components/ui/Icon.jsx` | +7 registry entries, `xl` size |
| `client/src/components/ui/SelectableCard.jsx` | **new** adapter |
| `client/src/components/ui/index.js` | export `SelectableCard` |
| `client/src/components/layout/AuthLayout.jsx` | **new** |
| `client/src/pages/LoginPage.jsx` | markup only |
| `client/src/pages/RegisterPage.jsx` | markup only |
| `client/src/pages/OnboardingPage.jsx` | shell markup only |
| `client/src/components/onboarding/IncomeStep.jsx` | markup only |
| `client/src/components/onboarding/CategoriesStep.jsx` | markup + `CATEGORY_META` |
| `client/src/index.css` | `fade-up` keyframe in `@layer utilities` |
| `client/src/locales/{he,en}.json` | new keys, both files |
| `docs/DESIGN.md` | note the auth/onboarding pattern under Visual Direction |

No server file, migration, service, hook, or route changes.

---

## Verification

1. **Tests unchanged and green.** `npm test` (server) is unaffected. `npm run test:e2e` from the
   repo root must pass **without editing a single spec** — that is the design constraint, not an
   afterthought. The specs that exercise these screens:
   - `e2e/auth.setup.js` — `getByLabel(t.auth.emailLabel)`, `getByRole('button', {name:
     t.auth.login.submit})`
   - `e2e/auth.spec.js` — login, register, `/onboarding` redirect
   - `e2e/onboarding.spec.js:27,33-35` — `getByLabel(t.onboarding.income.amountLabel)`,
     `getByLabel(housingLabel, {exact:true}).check()`, Finish button
   If `SelectableCard`'s hidden input is right, `.check()` keeps working. Run the suite **before**
   touching any spec — a failure there means the adapter is wrong, not the test.
2. **Manual, Hebrew (default locale).** `/login`, `/register`, `/onboarding` at 375px, 768px, and
   1440px. The brand panel appears only at `lg+`; the mobile card is not cramped; nothing scrolls
   horizontally; the gradient panel sits on the reading-order start side under RTL.
3. **i18n parity.** `he.json` and `en.json` have identical key sets. Toggle
   `LocaleContext` to `en` and confirm no raw key strings render.
4. **A11y.** Tab through each page: every field, the password toggles, every category card, and
   both footer buttons take a visible focus ring. Category cards announce as checkboxes with the
   category name. White-on-gradient text uses `--brand-gradient-strong` only.
5. **Token discipline.** `grep -nE "#[0-9a-fA-F]{3,6}|\b(ml|mr|pl|pr)-|shadow-xl|left-|right-"` over
   the touched client files returns nothing.
6. **Console clean.** No `Icon: unknown name` DEV warnings (proves every new registry key is
   spelled correctly at both ends), no ref warnings, no `console.log`.
