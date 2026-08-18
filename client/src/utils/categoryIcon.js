// Maps category names to a components/ui/Icon registry key and a deterministic
// accent-palette index. Pure util, zero lucide-react imports — mirrors
// categoryLabel.js's pattern of a fixed lookup with a safe fallback for
// real user-entered names. See docs/DASHBOARD-REDESIGN.md Step 3.
const ICON_BY_NAME = {
  Housing: 'home',
  Groceries: 'shoppingCart',
  Utilities: 'zap',
  Transport: 'car',
  Healthcare: 'heartPulse',
  'Dining Out': 'utensils',
  Entertainment: 'film',
  Shopping: 'bag',
  Savings: 'piggyBank',
};

const ACCENT_BY_NAME = {
  Housing: 5,
  Groceries: 1,
  Utilities: 3,
  Transport: 4,
  Healthcare: 2,
  'Dining Out': 2,
  Entertainment: 5,
  Shopping: 6,
  Savings: 6,
};

const ACCENT_COUNT = 6;

/** @param {string} name @returns {string} an components/ui/Icon `name` prop value */
export function getCategoryIconName(name) {
  return ICON_BY_NAME[name] ?? 'wallet';
}

// Stable char-sum hash so a user-created envelope keeps the same accent
// across reloads without needing a stored color (every existing envelope's
// `color` column is null — see docs/DASHBOARD-REDESIGN.md Corrections).
function hashToAccentIndex(name) {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (sum % ACCENT_COUNT) + 1;
}

/** @param {string} name @returns {number} 1..6, a `--cat-N` / `--cat-N-tint` token index */
export function getCategoryAccentIndex(name) {
  return ACCENT_BY_NAME[name] ?? hashToAccentIndex(name);
}
