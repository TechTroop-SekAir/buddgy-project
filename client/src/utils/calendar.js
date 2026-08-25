const CALENDAR_CONNECTED_KEY = 'buddgy_mock_calendar_connected';

// Mocked auth (mockAuthService.js) never sets user.connected/is_calendar_connected —
// it stashes connection state in localStorage instead, keyed by user id. Moved
// here (was inline in SettingsPage.jsx) so DashboardPage.jsx can share the exact
// same definition and the two can't drift.
function checkMockConnected(userId) {
  try {
    const raw = localStorage.getItem(CALENDAR_CONNECTED_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return ids.includes(userId) || ids.includes(String(userId)) || ids.includes(Number(userId));
  } catch {
    return false;
  }
}

/** Whether `user` has Google Calendar connected, real or mocked. */
export function isCalendarConnected(user) {
  const isMock = import.meta.env.VITE_USE_MOCK_CALENDAR === 'true';
  return Boolean(user?.connected || user?.is_calendar_connected || (isMock && checkMockConnected(user?.id)));
}
