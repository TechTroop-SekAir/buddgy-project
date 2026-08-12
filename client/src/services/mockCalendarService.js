// Fake backend for ticket A-12's connect/sync half, mirroring
// mockTransactionService.js's structure. C-05/C-06 are real and working
// server-side, but this keeps VITE_USE_MOCK_API=true fully functional
// without live Google OAuth creds. Writes into buddgy_mock_planned_expenses,
// read by mockPlannedExpenseService.js.
const CALENDAR_CONNECTED_KEY = 'buddgy_mock_calendar_connected';
const PLANNED_EXPENSES_KEY = 'buddgy_mock_planned_expenses';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadConnectedIds() {
  try {
    const raw = localStorage.getItem(CALENDAR_CONNECTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConnectedIds(ids) {
  localStorage.setItem(CALENDAR_CONNECTED_KEY, JSON.stringify(ids));
}

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

// Fixed sample events so a second sync is genuinely idempotent (same
// google_event_id → 0 newEvents), matching syncPlannedExpenses's real
// findOrCreate-by-google_event_id behavior.
const SAMPLE_EVENTS = [
  { google_event_id: 'mock-event-rent', title: 'Rent ₪4500', amount_agorot: 450000, daysFromNow: 3 },
  { google_event_id: 'mock-event-car', title: 'Car insurance 620 ILS', amount_agorot: 62000, daysFromNow: 10 },
  { google_event_id: 'mock-event-gym', title: 'Gym membership ₪160', amount_agorot: 16000, daysFromNow: 18 },
];

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// userId: the real endpoint derives the caller from the JWT and takes no
// such param, but the mock needs it to scope the connected flag and
// planned-expense rows — same call site as the real service, which simply
// ignores the extra argument (mirrors transactionService.parse's quirk).
export async function getConnectUrl(userId) {
  await delay(300);

  // Real /connect only returns Google's consent URL — the actual token
  // exchange happens later, server-side, on GET /calendar/callback. There's
  // no such round trip to fake here, so the mock marks the user connected
  // right away and points the "consent screen" straight at the same place
  // the real callback redirects to, so SettingsPage's `?calendar=connected`
  // handling is identical in both modes.
  const connectedIds = loadConnectedIds();
  if (!connectedIds.includes(userId)) {
    connectedIds.push(userId);
    saveConnectedIds(connectedIds);
  }

  return { url: '/settings?calendar=connected' };
}

export async function sync(userId) {
  await delay(500);

  const connectedIds = loadConnectedIds();
  if (!connectedIds.includes(userId)) {
    throw new Error('Google Calendar is not connected.');
  }

  const plannedExpenses = loadPlannedExpenses();
  const existingEventIds = new Set(
    plannedExpenses.filter((p) => p.user_id === userId).map((p) => p.google_event_id)
  );

  let newEvents = 0;
  SAMPLE_EVENTS.forEach((event) => {
    if (existingEventIds.has(event.google_event_id)) return;

    plannedExpenses.push({
      id: crypto.randomUUID(),
      user_id: userId,
      envelope_id: null,
      title: event.title,
      amount_agorot: event.amount_agorot,
      due_date: addDays(event.daysFromNow),
      google_event_id: event.google_event_id,
      is_confirmed: false,
    });
    newEvents += 1;
  });

  savePlannedExpenses(plannedExpenses);
  return { newEvents };
}

export async function disconnect(userId) {
  await delay(200);
  const connectedIds = loadConnectedIds().filter((id) => id !== userId);
  saveConnectedIds(connectedIds);
  // planned_expenses rows are intentionally kept, matching the real
  // DELETE /api/calendar/disconnect behavior.
  return { connected: false };
}
