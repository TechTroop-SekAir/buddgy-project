// No server-side income endpoint exists yet (backend-owned, not yet built) —
// see incomeService.js's header comment. Reads/writes localStorage so the
// dashboard has real, persistent numbers to show in the meantime.
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

export async function list(userId, month) {
  await delay(200);
  const monthPrefix = month.slice(0, 7);
  const rows = loadIncomeSources().filter((r) => r.user_id === userId && r.month.startsWith(monthPrefix));
  return { rows, total_agorot: rows.reduce((sum, r) => sum + r.amount_agorot, 0) };
}

// Not called anywhere yet — no income-entry UI exists. Included now so a
// future task can start writing income data without touching this file.
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
