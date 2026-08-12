// Maps raw error codes thrown by the mock/real services (see
// services/mockAuthService.js, mockEnvelopeService.js) to translated,
// user-facing text. Anything unrecognized falls back to errors.generic
// rather than leaking a raw code onto the screen.
const ERROR_KEYS = {
  unauthorized: 'errors.unauthorized',
  duplicate: 'errors.duplicate',
  'validation failed: email': 'errors.validation.email',
  'validation failed: password': 'errors.validation.password',
  'validation failed: name': 'errors.validation.name',
  'validation failed: monthly_budget_agorot': 'errors.validation.monthlyBudgetAgorot',
  'not found': 'errors.notFound',
};

export function getErrorMessage(message, t) {
  return t(ERROR_KEYS[message] ?? 'errors.generic');
}
