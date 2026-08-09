# Design System Reference

> Load this at the start of any session that involves writing or modifying UI components.
> This is the single source of truth for how components should look and behave.
> For visual token values, see `client/src/styles/tokens.css` (to be created).
> For the full design rationale, palette, and status colors, see `docs/DESIGN.md`.

---

## 1. How to Use This

**Never hardcode a design value.** No raw hex colors, pixel sizes, or magic numbers in JSX or CSS.

```jsx
// WRONG
<div style={{ color: '#0f172a', fontSize: '13px', borderRadius: '12px' }}>

// RIGHT
<div className="text-text-primary text-base rounded-md">
```

- All values flow from `tokens.css` → both `tailwind.config.js` and the Mantine theme → component
- **Mantine is the component layer** (buttons, inputs, cards, modals, date picker, dropzone, table, notifications). **Tailwind is for layout, grid and spacing.** Don't reach for a hand-rolled `<button>`/`<input>` when a Mantine component exists for it.
- **Mantine may only be imported inside `client/src/components/ui/`.** Pages and feature components import from `components/ui/`, never `from '@mantine/*'` directly. This is what keeps the component library swappable — see `CLAUDE.md`.
- When a new token is needed, add it to `tokens.css` first, then wire it into `tailwind.config.js` and the Mantine theme override — never invent a one-off value inline
- `tokens.css` must be imported in `main.jsx` before anything else

---

## 2. Button Patterns

Implemented as `components/ui/Button.jsx`, wrapping Mantine's `<Button>`. Feature code never imports `@mantine/core`'s `Button` directly.

### Variants

**Primary** — the main action on a screen. Use once per view.
```jsx
<Button variant="filled" color="accent" size="md">
  Save Expense
</Button>
```

**Secondary** — lower-emphasis action, alongside a primary.
```jsx
<Button variant="outline" color="gray" size="md">
  Cancel
</Button>
```

**Danger** — destructive actions (delete envelope, disconnect Google Calendar). Always paired with a confirmation dialog — never fire on a single click.
```jsx
<Button variant="subtle" color="red" size="md" onClick={openConfirmModal}>
  Delete Envelope
</Button>
```
```jsx
// Canonical confirm pattern — e.g. disconnecting the Google account
openConfirmModal({
  title: 'Disconnect Google Calendar?',
  message: 'Planned expenses synced from your calendar will no longer update automatically.',
  confirmLabel: 'Disconnect',
  confirmColor: 'red',
  onConfirm: disconnectCalendar,
});
```

### Button Rules
- Minimum touch target: 44×44px — use `size="md"` or larger, never shrink below it
- Never remove the focus ring — Mantine's default focus ring uses the theme's `accent`; don't override it away
- `disabled` must use the real `disabled` prop, not just visual styling
- Loading state: `<Button loading>` — Mantine handles the spinner and `aria-busy` swap; keep the button width stable

---

## 3. Form Patterns

Implemented as `components/ui/TextInput.jsx`, `components/ui/NumberInput.jsx`, etc., wrapping Mantine's form inputs.

### Input
```jsx
<TextInput
  label="Envelope Name"
  placeholder="Groceries"
  required
/>
```

### Money Input Rule

**Inputs always display and accept shekels; state and the API always use integer agorot.** Conversion happens only at the UI/API boundary via a shared helper (`shekelsToAgorot` / `agorotToShekels`) — never convert ad hoc inside a component, and never store a float.

```jsx
<NumberInput
  label="Monthly Budget"
  prefix="₪"
  decimalScale={2}
  value={agorotToShekels(envelope.monthly_budget_agorot)}
  onChange={(shekels) => onChange(shekelsToAgorot(shekels))}
/>
```

### Validation States

**Error state:**
```jsx
<NumberInput label="Amount" error="Amount must be greater than 0" />
```

**Success state** — use sparingly, only when confirmation adds real value:
```jsx
<TextInput label="Envelope Name" description="Saved." />
```

### Form Rules
- Labels are always visible — use Mantine's `label` prop, never placeholder-only labels
- Validate inline on blur, not only on submit
- Error messages must be specific: "Amount must be greater than 0" not "Invalid input"
- Group related fields with Mantine's `<Fieldset>` (renders a `<fieldset>`/`<legend>` under the hood)

---

## 4. Card Patterns

Implemented as `components/ui/Card.jsx`, wrapping Mantine's `<Card withBorder>`.

### Standard Card
```jsx
<Card withBorder radius="md" p="lg">
  {/* content */}
</Card>
```

### Envelope Card — canonical example
```jsx
<Card withBorder radius="md" p="lg">
  <Group justify="space-between">
    <Text fw={600}>{envelope.name}</Text>
    <Badge color={statusColor(envelope)}>{statusLabel(envelope)}</Badge>
  </Group>
  <Text size="sm" c="dimmed">
    {formatShekels(remaining)} left of {formatShekels(envelope.monthly_budget_agorot)}
  </Text>
  <Progress value={percentUsed} color={statusColor(envelope)} mt="sm" />
</Card>
```

### Card Rules
- Background: always the surface token (`bg-bg-surface`) — cards sit on `bg-bg-page`
- Border: always present — never omit, never use shadow as a substitute for border
- Radius: `md` (12px) for cards, `lg` (16px) for outer page containers only
- Shadow: `sm` default; `md` for modals or elevated overlays; `lg` for dropdowns
- Internal padding: `p="lg"` (matches `px-6 py-5` in the token scale)
- Gap between stacked cards: `gap-3` (12px)
- Never nest cards more than one level deep

---

## 5. Typography Patterns

| Use case | Tailwind classes |
|---|---|
| Page / section heading | `text-3xl font-semibold tracking-tight` |
| Subheading / envelope name | `text-xl font-semibold tracking-tight` |
| Wordmark / nav title | `text-2xl font-semibold` |
| Body text | `text-base text-text-secondary` |
| Supporting / description | `text-base text-text-secondary` |
| Field label | `text-xs font-semibold uppercase tracking-[0.06em] text-text-muted` |
| Button label | `text-md font-medium tracking-tight` |
| Tag / badge (envelope status) | `text-xs font-medium` |
| Month selector meta (nav) | `text-sm font-medium text-text-secondary` |

### Typography Rules
- Font family is set globally via `font-sans` on `<body>` — don't set it per-component
- Heading hierarchy: one `<h1>` per page, use `<h2>`–`<h4>` for sub-sections — semantic HTML matters
- Never use `font-bold` (700) — the heaviest weight in this system is `font-semibold` (600)
- Negative tracking (`tracking-tight`) only on headings — never on body text or labels
- Money values always render through a shared `formatShekels()` helper — never interpolate `_agorot` fields directly into JSX

---

## 6. Spacing Rules

### Internal padding (inside a component)
| Component | Value |
|---|---|
| Page body | `px-8 py-9` (32px / 36px) |
| Nav bar | `px-8 py-5` (32px / 20px) |
| Card | `px-6 py-5` (24px / 20px) |
| Input | `px-3 py-2` (12px / 8px) |
| Button | `px-6 py-[11px]` |

### Between-element spacing (gap / margin)
| Context | Value |
|---|---|
| Envelope grid (cards) | `gap-3` (12px) |
| Transaction list rows | `gap-2` (8px) |
| Label → input | `gap-[6px]` |
| Section subtext → first card | `mb-7` (28px) |
| Description → summary row | `mb-4` (16px) |
| Button below a form section | `mt-6` (24px) |

### Spacing Rules
- Use `gap` on flex/grid parents rather than `margin` on children
- Page-level vertical rhythm: sections are separated by `mb-16` (64px)
- Never use arbitrary pixel values outside of this table — add a new token if needed

---

## 7. Color Usage Rules

| Token | When to use |
|---|---|
| `bg-bg-page` | The root page background — outermost layer only |
| `bg-bg-surface` | Cards, nav, modals — any elevated surface |
| `bg-bg-input` | Input fields and textareas only |
| `text-text-primary` | Headings, envelope names, any primary content |
| `text-text-secondary` | Body copy, descriptions, supporting text |
| `text-text-muted` | Labels, metadata, placeholders, empty states |
| `accent` / `bg-accent` | Primary buttons, active states, focus rings, links |
| `accent-subtle` / `bg-accent-subtle` | Tags, badges, highlighted rows — never for large areas |
| `border-border-nav` | Horizontal nav dividers only |
| `border-border-card` | Card borders, input borders (default state) |

### Envelope & Forecast Status Colors

Buddgy-specific semantic states, distinct from the reserved error/success colors below:

| State | Token | Meaning |
|---|---|---|
| On track | `status-ok` (green-toned, but a *dedicated* token — do not reuse `green-600`) | Remaining balance comfortably covers the rest of the month |
| Near depletion | `status-warning` (amber-toned) | Envelope is close to its budget limit |
| Over budget | `status-danger` (red-toned, but a *dedicated* token — do not reuse `red-600`) | Envelope has exceeded its monthly budget |
| Projected shortfall | `status-forecast-alert` | Cash-flow forecast projects a negative end-of-month balance |

These are status indicators, not error/success feedback — keep them visually distinguishable from form validation states even where the hue is similar.

### Color Rules
- `accent` is the only interactive color — don't introduce ad-hoc blues, greens, or purples
- Red (`red-400` / `red-600`) is reserved exclusively for form errors and destructive-action UI
- Green (`green-500` / `green-600`) is reserved exclusively for success confirmations (e.g. "Saved.")
- Never use `text-text-muted` for interactive elements — it fails contrast requirements
- Background layering is always: `bg-page` → `bg-surface` — never surface on surface

---

## 8. Accessibility Non-Negotiables

### Focus
- Every interactive element must have a visible focus ring
- Use the theme's default Mantine focus ring (mapped to `accent`) — don't disable it
- Focus order must follow visual reading order — avoid `tabindex` hacks

### Contrast
- `text-text-primary` on `bg-bg-surface`: passes WCAG AA (and AA Large)
- `text-text-secondary` on `bg-bg-surface`: passes WCAG AA
- `text-text-muted` on `bg-bg-surface`: use only for non-essential decorative text — do not use for interactive labels or error messages
- White text on `accent`: passes WCAG AA — safe for buttons

### Touch targets
- Minimum 44×44px for all interactive elements
- Money inputs (Quick Entry, envelope budget): ensure the tap area is large enough for fast, one-handed entry — use `size="md"` or larger, never the compact Mantine size
- Buttons: default sizing already meets this — don't reduce it

### ARIA
- Inputs must have associated labels (Mantine's `label` prop renders a real `<label htmlFor>`, not just proximity)
- Error messages linked with `aria-describedby` (Mantine wires this automatically via the `error` prop — don't bypass it with a manually placed `<p>`)
- Invalid fields marked with `aria-invalid="true"`
- Loading buttons: `loading` prop → `aria-busy="true"` + `disabled`
- Icon-only buttons: `aria-label` required
- Forecast shortfall alerts and other live status changes: wrap in `aria-live="polite"` region — announce, don't interrupt

---

## 9. Tokens, Tailwind, and Mantine: How They Work Together

### The chain
```
tokens.css (:root variables)
    ↓                              ↓
tailwind.config.js            Mantine theme (MantineProvider)
    ↓                              ↓
Tailwind className              components/ui/*.jsx (Mantine imported ONLY here)
    ↓                              ↓
              pages/ + feature components
```

Feature code never imports from `@mantine/*` directly and never hardcodes a color/size/radius. Everything routes through `tokens.css` and lands in either a Tailwind class or a `components/ui/` component. This is what makes the UI library swappable later — a swap means rewriting `components/ui/`, nothing else.

### What's available in Tailwind (layout/spacing use)

| Category | Utility prefix | Example |
|---|---|---|
| Colors | `bg-`, `text-`, `border-` | `bg-accent`, `text-text-primary`, `border-border-card` |
| Border radius | `rounded-` | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-pill` |
| Shadows | `shadow-` | `shadow-sm`, `shadow-md`, `shadow-lg` |
| Transition duration | `duration-` | `duration-fast`, `duration-base`, `duration-slow` |
| Font size | `text-` | `text-xs`, `text-base`, `text-3xl` |
| Font family | `font-` | `font-sans` (set on body) |

### When to use `style={{}}` instead of className
Only when the value is truly dynamic (e.g. a progress bar's fill percentage). Even then, reference a computed value, never a hardcoded one:
```jsx
// Acceptable dynamic use
<div style={{ width: `${percentUsed}%` }} />

// Still wrong even if dynamic
<div style={{ color: '#6366f1' }} />
```

### Arbitrary values
Tailwind's `[]` syntax is allowed only for values that are genuinely one-off layout needs (e.g. `py-[11px]` for button padding). If you use the same arbitrary value twice, it belongs in a token.
