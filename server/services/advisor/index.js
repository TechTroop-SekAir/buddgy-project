'use strict';

const claudeService = require('../claudeService');
// stepCountIs/hasToolCall come from claudeService, not a direct `require('ai')`
// here — claudeService.js is the only file that touches the `ai` package
// directly (see its module.exports comment); this keeps every test that
// mocks `../services/claudeService` wholesale insulated from `ai`'s
// ESM-only build. Every module under services/advisor/ must keep this
// invariant — no direct `ai`/`@ai-sdk/anthropic` require anywhere here.
const { stepCountIs, hasToolCall } = claudeService;
const envelopeService = require('../envelopeService');
const forecastService = require('../forecastService');
const AppError = require('../../utils/AppError');
const { MAX_TOOL_LOOP_STEPS } = require('./constants');
const { buildAdvisorTools } = require('./tools');
const { provideVerdictTool } = require('./verdictSchema');
const { buildSystemPrompt } = require('./prompts');
const { resolveVerdict } = require('./resolveVerdict');

// The route only ever gives ask() free text (server/routes/advisor.js's
// { text }-only body) — no month, unlike every other envelope/forecast
// caller. Mirrors client/src/utils/month.js#getCurrentMonth()'s
// 'YYYY-MM-01' format server-side, since envelopeService.normalizeMonth
// throws on a missing month rather than defaulting it.
function getCurrentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}-01`;
}

/**
 * Answers a free-text budget question via a read-only tool-use loop over
 * the user's real envelopes/forecast — docs/features/AGENTS.md § Agent 1.
 * Never persists anything; if the user acts on the suggestion, that goes
 * through the existing envelope/transaction UI and endpoints.
 *
 * @param {number} userId
 * @param {string} text
 * @param {Array<{role: 'user'|'assistant', content: string}>} [history] - client-side-only
 *   conversation history for this chat session (never persisted — see
 *   server/routes/advisor.js), most recent turn last, not including `text`.
 * @returns {Promise<{ verdict: 'in_budget'|'near_limit'|'over_budget', amountAgorot: number|null, projectedBalanceAfterAgorot: number|null, suggestion: {envelopeId:number, envelopeName:string, cutAgorot:number}|null, explanationKey: string, reasoning: string|null }>}
 */
async function ask(userId, text, history = []) {
  const currentMonth = getCurrentMonth();

  // Fetched once, up front — both the tools' data source and this
  // function's own authoritative source for id revalidation + the JS-side
  // arithmetic in resolveVerdict, so the model reasons over the exact
  // numbers used in the final calculation. Both already degrade to
  // []/zeroed output for a user with zero envelopes.
  const [envelopes, forecast] = await Promise.all([
    envelopeService.list(userId, currentMonth),
    forecastService.get(userId, currentMonth),
  ]);
  const validEnvelopeIds = new Set(envelopes.map((e) => e.id));

  const tools = {
    ...buildAdvisorTools({ envelopes, forecast, userId, currentMonth, validEnvelopeIds }),
    provide_verdict: provideVerdictTool,
  };

  let result;
  try {
    result = await claudeService.runToolLoop({
      system: buildSystemPrompt({ envelopes, forecast, today: new Date().toISOString().slice(0, 10) }),
      prompt: text,
      messages: history.length ? history : undefined,
      tools,
      stopWhen: [stepCountIs(MAX_TOOL_LOOP_STEPS), hasToolCall('provide_verdict')],
      // No `temperature` here (previously 0): Claude Sonnet 5 removed
      // sampling params (temperature/top_p/top_k) — the AI SDK silently
      // strips it and warns "not supported ... will be ignored", so this
      // was inert. A 9-run repro (2026-08-26, claude-sonnet-5, an
      // intentionally ambiguous 5-envelope fixture) returned the identical
      // suggested_envelope_id every time even with the parameter gone —
      // Bug 2 ("identical questions yield different suggestions") did not
      // reproduce on this model. resolveVerdict's pickCutEnvelope() now
      // makes the envelope choice a JS-verified guarantee regardless, so
      // determinism no longer depends on the model at all.
    });
  } catch {
    // Timeout, rate limit, or a malformed provide_verdict call (schema
    // validation failure) — same failure contract as every other function
    // in claudeService.js. Never leak the raw SDK error.
    await claudeService.logAiCall(userId, 'budget_advisor', false);
    throw new AppError('unprocessable: ai parse failed', 422);
  }

  const verdictCall = result.toolCalls.find((call) => call.toolName === 'provide_verdict');
  if (!verdictCall) {
    // Loop exhausted MAX_TOOL_LOOP_STEPS without ever submitting a verdict —
    // a real Anthropic call still happened (and cost spend), it just never
    // produced a usable answer.
    await claudeService.logAiCall(userId, 'budget_advisor', false);
    throw new AppError('unprocessable: ai parse failed', 422);
  }
  await claudeService.logAiCall(userId, 'budget_advisor', true);

  return resolveVerdict({ answer: verdictCall.input, envelopes, validEnvelopeIds, forecast });
}

module.exports = { ask };
