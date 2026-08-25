'use strict';

const { isEssentialEnvelope } = require('./essentialEnvelopes');
const { shekelsToAgorot } = require('../../utils/money');

function mapExplanationKey(verdict, amountAgorot, suggestion) {
  if (verdict === 'over_budget') {
    return suggestion ? 'advisor.reply.overBudgetWithSuggestion' : 'advisor.reply.overBudgetNoSuggestion';
  }
  if (verdict === 'near_limit') return 'advisor.reply.nearLimit';
  return amountAgorot != null ? 'advisor.reply.inBudget' : 'advisor.reply.inBudgetStatus';
}

/**
 * Turns a validated provide_verdict answer plus the real envelope/forecast
 * context into the response shape ask() returns — the entire
 * model-independent decision logic in one pure, side-effect-free place. No
 * I/O, no `claudeService`, nothing async: everything the model doesn't get
 * to be trusted on lives here.
 *
 * @param {{ answer: object, envelopes: Array, validEnvelopeIds: Set<number>, forecast: object }} params
 * @returns {{ verdict: string, amountAgorot: number|null, projectedBalanceAfterAgorot: number, suggestion: {envelopeId:number, envelopeName:string, cutAgorot:number}|null, explanationKey: string, reasoning: string|null }}
 */
function resolveVerdict({ answer, envelopes, validEnvelopeIds, forecast }) {
  // Money math happens here, in JS, never trusting the model's arithmetic —
  // same rule parseQuickEntry's header comment states. Computed
  // unconditionally (subtracting 0 is a no-op) so it's always a number,
  // never null, even for a pure status question with no amount — the
  // client's nearLimit/inBudgetStatus locale keys always need a balance to
  // interpolate.
  const amountAgorot = answer.amount_shekels != null ? shekelsToAgorot(answer.amount_shekels) : null;
  const projectedBalanceAfterAgorot = forecast.projectedBalanceAgorot - (amountAgorot ?? 0);

  // Hallucination guard — identical pattern to parseQuickEntry's
  // suggested_envelope_id / classifyEventCostLikelihood's google_event_id
  // in claudeService.js: the model's judgment about WHICH envelope is
  // trusted, the id's VALIDITY never is.
  const rawSuggestedEnvelope = validEnvelopeIds.has(answer.suggested_envelope_id)
    ? envelopes.find((e) => e.id === answer.suggested_envelope_id)
    : null;

  // Essential-spending guardrail (re-checked here, not just excluded from
  // the prompt) — the prompt tells the model never to pick a flagged
  // envelope, but a prompt instruction is guidance, not a guarantee, so
  // this is the actual enforcement. Same posture as the id-validity check
  // above: never trust the model to honor a rule on its own when JS can
  // verify it directly.
  const suggestedEnvelope = rawSuggestedEnvelope && !isEssentialEnvelope(rawSuggestedEnvelope.name) ? rawSuggestedEnvelope : null;

  // The cut amount is arithmetic, so it's derived here — never taken from
  // the model (same rule as amountAgorot above; a prior version asked the
  // model for this and got 100.00 vs 99.99 for an identical question).
  // Shortfall is the JS-computed deficit, capped at the chosen envelope's
  // own headroom so the suggestion never asks for more than it can give.
  const shortfallAgorot = projectedBalanceAfterAgorot < 0 ? -projectedBalanceAfterAgorot : 0;
  const headroomAgorot = suggestedEnvelope
    ? Math.max(0, suggestedEnvelope.monthly_budget_agorot - suggestedEnvelope.spent_agorot)
    : 0;
  const cutAgorot = Math.min(shortfallAgorot, headroomAgorot);
  const suggestion =
    suggestedEnvelope != null && cutAgorot > 0
      ? { envelopeId: suggestedEnvelope.id, envelopeName: suggestedEnvelope.name, cutAgorot }
      : null;

  return {
    verdict: answer.verdict,
    amountAgorot,
    projectedBalanceAfterAgorot,
    suggestion,
    explanationKey: mapExplanationKey(answer.verdict, amountAgorot, suggestion),
    // Free-text follow-up explanation (Bug 1 fix) — null on a normal spending
    // verdict, so mapExplanationKey's locale key is still what renders then.
    reasoning: answer.reasoning_text ?? null,
  };
}

module.exports = { resolveVerdict };
