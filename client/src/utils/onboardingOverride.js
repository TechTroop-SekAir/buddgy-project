// Fallback for when PATCH /api/auth/onboarding doesn't exist server-side yet
// (backend not shipped) — see DashboardPage.jsx's onboardingMutation. Not the
// same thing as mockAuthService.completeOnboarding(): that decodes a
// mock-shaped token and looks the user up in its own separate
// buddgy_mock_users store, so it can't stand in for a real-mode user (real
// JWTs have a different payload shape and the user was never registered into
// that store). This just remembers "onboarding is done" for this user id
// locally, so the wizard doesn't reopen every time the real user object
// comes back from the server still missing the column.
const KEY = 'buddgy_onboarding_override';

function loadOverrides() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function hasLocalOnboardingOverride(userId) {
  return Boolean(loadOverrides()[userId]);
}

export function setLocalOnboardingOverride(userId) {
  const overrides = loadOverrides();
  overrides[userId] = true;
  localStorage.setItem(KEY, JSON.stringify(overrides));
}
