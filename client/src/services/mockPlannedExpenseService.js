// Fake backend for ticket A-12's assign half. GET /api/planned-expenses and
// PATCH /api/planned-expenses/:id don't exist server-side (see
// plannedExpenseService.js's header comment) so this reads/writes the same
// buddgy_mock_planned_expenses rows mockCalendarService.js's sync() writes.
const PLANNED_EXPENSES_KEY = 'buddgy_mock_planned_expenses';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadPlannedExpenses() {
  try {
    const raw = localStorage.getItem(PLANNED_EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePlannedExpenses(plannedExpenses) {
  localStorage.setItem(PLANNED_EXPENSES_KEY, JSON.stringify(plannedExpenses));
}

export async function list(userId, month) {
  await delay(200);
  const monthPrefix = month.slice(0, 7);
  return loadPlannedExpenses().filter(
    (p) => p.user_id === userId && p.due_date.startsWith(monthPrefix)
  );
}

export async function update(id, payload) {
  await delay(200);
  const plannedExpenses = loadPlannedExpenses();
  const index = plannedExpenses.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('not found');

  plannedExpenses[index] = { ...plannedExpenses[index], ...payload };
  savePlannedExpenses(plannedExpenses);

  return plannedExpenses[index];
}
