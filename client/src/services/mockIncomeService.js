// localStorage-backed stand-in for server/routes/income.js, used when
// VITE_USE_MOCK_API=true — see incomeService.js's header comment.
const INCOME_SOURCES_KEY = 'buddgy_mock_income_sources';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadIncomeSources() {
  try {
    const raw = localStorage.getItem(INCOME_SOURCES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIncomeSources(incomeSources) {
  localStorage.setItem(INCOME_SOURCES_KEY, JSON.stringify(incomeSources));
}

export async function list(userId, month, fallback) {
  await delay(200);
  const monthPrefix = month.slice(0, 7);
  const all = loadIncomeSources().filter((r) => r.user_id === userId);
  let rows = all.filter((r) => r.month.startsWith(monthPrefix));

  if (rows.length === 0 && fallback === 'previous') {
    // Mirrors incomeSourceService.js's server-side fallback: latest earlier
    // month with rows, returned unsaved (id: null) as a draft for this month.
    const earlier = all
      .filter((r) => r.month.slice(0, 7) < monthPrefix)
      .sort((a, b) => (a.month < b.month ? 1 : -1));
    const carriedFrom = earlier[0]?.month ?? null;
    if (carriedFrom) {
      rows = earlier
        .filter((r) => r.month === carriedFrom)
        .map((r) => ({ ...r, id: null, month }));
    }
    return { rows, total_agorot: rows.reduce((sum, r) => sum + r.amount_agorot, 0), carried_from: carriedFrom };
  }

  const result = { rows, total_agorot: rows.reduce((sum, r) => sum + r.amount_agorot, 0) };
  if (fallback === 'previous') result.carried_from = null;
  return result;
}

export async function replace(userId, month, rows) {
  await delay(200);
  const monthPrefix = month.slice(0, 7);
  const others = loadIncomeSources().filter((r) => !(r.user_id === userId && r.month.startsWith(monthPrefix)));
  const next = rows.map((row, index) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    month,
    label: row.label,
    amount_agorot: row.amount_agorot,
    sort_order: index,
  }));
  saveIncomeSources([...others, ...next]);
  return { rows: next, total_agorot: next.reduce((sum, r) => sum + r.amount_agorot, 0) };
}
