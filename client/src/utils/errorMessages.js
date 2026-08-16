// Maps raw error strings thrown by the API layer (services/api.js unwraps
// the {data, error} envelope into an Error whose message is the server's
// error string) to translated, user-facing text. Anything unrecognized falls
// back to errors.generic rather than leaking a raw server string onto the
// screen. Keys with `envelope`/`monthly_budget_agorot` in them mirror the
// backend's Zod schemas (server/routes/envelopes.js,
// server/routes/transactions.js) verbatim — the backend still calls this
// resource "envelope"; see services/categoryService.js for the rename note.
const ERROR_KEYS = {
  unauthorized: 'errors.unauthorized',
  duplicate: 'errors.duplicate',
  'validation failed: email': 'errors.validation.email',
  'validation failed: password': 'errors.validation.password',
  'validation failed: name': 'errors.validation.name',
  'validation failed: monthly_budget_agorot': 'errors.validation.monthlyBudgetAgorot',
  'validation failed: envelope_id': 'errors.validation.envelopeId',
  'validation failed: amount_agorot': 'errors.validation.amountAgorot',
  'validation failed: transaction_date': 'errors.validation.transactionDate',
  'validation failed: description': 'errors.validation.description',
  'not found': 'errors.notFound',
};

export function getErrorMessage(message, t) {
  return t(ERROR_KEYS[message] ?? 'errors.generic');
}
