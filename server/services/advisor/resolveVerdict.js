'use strict';

const { isEssentialEnvelope, isDiscretionaryEnvelope } = require('./essentialEnvelopes');
const { shekelsToAgorot } = require('../../utils/money');

/**
 * Chooses which envelope to cut from — deterministically, in JS. The model's
 * `suggested_envelope_id` is consulted only as a tie-break inside an
 * already-tied group; it never decides the outcome on its own. See
 * docs/features/AGENTS.md § Agent 1 "Deterministic cut pick" for why: a
 * `temperature: 0` request param + a prompt-only tie-break rule were both
 * tried first and neither actually guaranteed determinism (temperature is
 * silently ignored by Claude Sonnet 5; the prompt rule is guidance, not an
 * enforcement).
 *
 * Ranking, most-preferred first:
 *   1. Hard exclude: essential-blocklisted names, or headroom <= 0.
 *   2. Tier: discretionary-keyword names rank above unmatched names.
 *   3. Within a tier: most headroom (budget minus spent) first.
 *   4. Tie-break: if the model's pick lands inside the current best group
 *      (same tier AND identical headroom as the top candidate), use it —
 *      every member of that group is identical on every criterion this
 *      function can verify, so honoring the model's read costs nothing and
 *      may add the semantic judgment JS can't reproduce (e.g. "Vacations"
 *      vs. "Kids' school supplies", neither of which is keyword-tagged).
 *   5. Otherwise: lowest id.
 *
 * @param {{ envelopes: Array, modelPickId: number|null, validEnvelopeIds: Set<number> }} params
 * @returns {object|null} the winning envelope object, or null if none qualifies
 */
function pickCutEnvelope({ envelopes, modelPickId, validEnvelopeIds }) {
  const candidates = envelopes
    .filter((e) => !isEssentialEnvelope(e.name))
    .map((e) => ({ envelope: e, headroomAgorot: Math.max(0, e.monthly_budget_agorot - e.spent_agorot) }))
    .filter((c) => c.headroomAgorot > 0);

  if (candidates.length === 0) return null;

  const rank = (c) => (isDiscretionaryEnvelope(c.envelope.name) ? 1 : 0);

  candidates.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(b) - rank(a); // discretionary tier first
    if (a.headroomAgorot !== b.headroomAgorot) return b.headroomAgorot - a.headroomAgorot; // most headroom first
    return a.envelope.id - b.envelope.id; // lowest id last, as the final fallback
  });

  const top = candidates[0];
  const tieGroup = candidates.filter((c) => rank(c) === rank(top) && c.headroomAgorot === top.headroomAgorot);

  const modelPickInTieGroup =
    modelPickId != null && validEnvelopeIds.has(modelPickId) && tieGroup.some((c) => c.envelope.id === modelPickId);

  return modelPickInTieGroup ? tieGroup.find((c) => c.envelope.id === modelPickId).envelope : top.envelope;
}

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

  // The choice of WHICH envelope to cut from is made entirely in JS — see
  // pickCutEnvelope's own doc comment for why the model can no longer own
  // this decision. The model's suggested_envelope_id is passed through only
  // as an optional tie-break; id validity and the essential-envelope
  // guardrail are both enforced inside pickCutEnvelope itself, not here.
  const suggestedEnvelope = pickCutEnvelope({ envelopes, modelPickId: answer.suggested_envelope_id, validEnvelopeIds });

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

module.exports = { resolveVerdict, pickCutEnvelope };
