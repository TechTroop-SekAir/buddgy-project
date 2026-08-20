'use strict';

const { z } = require('zod');
const claudeService = require('../services/claudeService');
// stepCountIs/hasToolCall come from claudeService, not a direct `require('ai')`
// here — claudeService.js is the only file that touches the `ai` package
// directly (see its module.exports comment); this keeps every test that
// mocks `../services/claudeService` wholesale insulated from `ai`'s
// ESM-only build.
const { stepCountIs, hasToolCall } = claudeService;
const envelopeService = require('../services/envelopeService');
const forecastService = require('../services/forecastService');
const transactionService = require('../services/transactionService');
const AppError = require('../utils/AppError');
const { shekelsToAgorot, agorotToShekels } = require('../utils/money');

// Agent 1 — Budget Advisor (docs/features/AGENTS.md § Agent 1). Read-only
// tool-use loop: no tool here ever calls a write path. If the user acts on
// a suggestion, that goes through the existing envelope/transaction UI and
// endpoints — this agent only answers.
const MAX_TOOL_LOOP_STEPS = 3; // AGENTS.md § Risks — advisor-specific stop condition

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

// Tools speak shekels, never agorot — the money-math-in-JS rule
// (parseQuickEntry's header comment) applies just as much to what we hand
// the model as to what we ask it to compute.
// Plain object literals, not the SDK's `tool()` helper — `tool()` is a
// pure identity function in this SDK version (exists only for TypeScript
// inference), so skipping it avoids a direct `require('ai')` here (see the
// stepCountIs/hasToolCall comment above) with no behavior difference.
function buildAdvisorTools({ envelopes, forecast, userId, currentMonth, validEnvelopeIds }) {
  return {
    get_envelopes: {
      description:
        "Lists the user's budget envelopes for the current month, each with its monthly budget " +
        'and amount already spent (both in whole ILS shekels). You already have this data in the ' +
        "system prompt — only call this again if you've lost track of the ids.",
      inputSchema: z.object({}),
      execute: async () => ({
        envelopes: envelopes.map((e) => ({
          id: e.id,
          name: e.name,
          monthly_budget_shekels: agorotToShekels(e.monthly_budget_agorot),
          spent_shekels: agorotToShekels(e.spent_agorot),
        })),
      }),
    },

    get_forecast: {
      description:
        "The user's month-end cash-flow forecast: projected end-of-month balance, which envelopes " +
        'are already projected to go negative (at risk), and an existing cut recommendation if the ' +
        'month is already tight. Use this to judge whether a new, unbudgeted expense would push the ' +
        'month into deficit.',
      inputSchema: z.object({}),
      execute: async () => ({
        projected_balance_shekels: agorotToShekels(forecast.projectedBalanceAgorot),
        at_risk_envelope_ids: forecast.atRiskEnvelopes,
        existing_recommendation: forecast.recommendation
          ? {
              envelope_id: forecast.recommendation.envelopeId,
              envelope_name: forecast.recommendation.envelopeName,
              cut_shekels: agorotToShekels(forecast.recommendation.cutAgorot),
            }
          : null,
      }),
    },

    get_recent_transactions: {
      description:
        "Recent transactions for one specific envelope this month, for context on why it's tight " +
        '(e.g. many small purchases vs. one big one). Only call this if you need that context — ' +
        'most questions can be answered from get_envelopes and get_forecast alone.',
      inputSchema: z.object({
        envelope_id: z
          .number()
          .int()
          .describe('The id of the envelope to inspect — must be one of the ids from get_envelopes. Never invent an id.'),
      }),
      execute: async ({ envelope_id }) => {
        // A bad/out-of-range id from the model must never throw and abort
        // the whole loop — hand back a recoverable result the model can
        // react to, same "never trust a model-supplied id blind" posture
        // as the final-answer revalidation below.
        if (!validEnvelopeIds.has(envelope_id)) {
          return { error: 'unknown envelope_id — call get_envelopes for the valid list' };
        }
        const transactions = await transactionService.list(userId, { month: currentMonth, envelopeId: envelope_id });
        return {
          transactions: transactions.slice(0, 10).map((t) => ({
            amount_shekels: agorotToShekels(t.amount_agorot),
            description: t.description,
            date: t.transaction_date,
          })),
        };
      },
    },
  };
}

// The loop's final step is itself a tool call — the AI SDK validates the
// model's arguments against this schema automatically (same guarantee
// generateObject gives parseQuickEntry: an invalid call throws, caught by
// ask()'s try/catch below), so there's no separate follow-up call needed to
// force structure.
const verdictSchema = z.object({
  verdict: z
    .enum(['in_budget', 'near_limit', 'over_budget'])
    .describe(
      'in_budget: after accounting for this, the projected end-of-month balance stays comfortably ' +
        '>= 0. near_limit: stays >= 0 but within a thin margin (use judgment — e.g. within roughly ' +
        '10% of total monthly budget, or the closest relevant envelope is nearly exhausted). If the ' +
        'question has no new-spend amount at all (e.g. a status check like "how much is left in ' +
        'Groceries?"), base this on the CURRENT forecast/envelope state instead of a hypothetical ' +
        'spend. over_budget: would push the projected balance negative unless something is cut.'
    ),
  amount_shekels: z
    .number()
    .nullable()
    .describe(
      'The shekel amount of the new/hypothetical spend the user is asking about, as a decimal ' +
        'number (e.g. 400 for "400 NIS"). null if the question has no concrete new-spend amount ' +
        '(e.g. a pure status question like "how much is left in Groceries?").'
    ),
  suggested_envelope_id: z
    .number()
    .int()
    .nullable()
    .describe(
      'Only when verdict is over_budget: the id of the ONE existing envelope you judge best to cut ' +
        'from to absorb the shortfall, chosen ONLY from ids you were given via get_envelopes — never ' +
        'invent one. Prefer an envelope that reads as discretionary/non-essential by its name (e.g. ' +
        'dining out, entertainment, subscriptions, shopping) over one that reads as essential (e.g. ' +
        'rent, groceries, utilities, insurance) — use your own judgment on the name and any context ' +
        'from get_recent_transactions, there is no essential/discretionary flag in the data. Only ' +
        'choose an envelope that has enough headroom (budget minus spent) to absorb the cut. null if ' +
        'verdict is not over_budget, or no envelope has enough headroom to help.'
    ),
  cut_shekels: z
    .number()
    .nullable()
    .describe('Only set when suggested_envelope_id is set: how much to cut from that envelope, in shekels, to close the shortfall.'),
});

const provideVerdictTool = {
  description:
    'Call this exactly once, as your final step, once you have enough information to answer — ' +
    "submits your structured verdict for the user's question. Do not call any other tool after this, " +
    'and never answer in plain text instead.',
  inputSchema: verdictSchema,
  execute: async (input) => input, // no side effect — exists purely to force a structured, validated final answer
};

function buildSystemPrompt({ envelopes, forecast, today }) {
  const envelopeList = envelopes.length
    ? envelopes
        .map((e) => `- id ${e.id}: "${e.name}" — budget ${agorotToShekels(e.monthly_budget_agorot)} ILS, spent ${agorotToShekels(e.spent_agorot)} ILS so far this month`)
        .join('\n')
    : '(the user has no envelopes yet this month)';

  return [
    `Today's date is ${today}. You are Buddgy's Budget Advisor — you answer a user's free-text ` +
      'spending question using their real budget data, read-only.',
    '',
    "The user's envelopes for the current month:",
    envelopeList,
    '',
    `Current month-end forecast: projected balance ${agorotToShekels(forecast.projectedBalanceAgorot)} ILS` +
      (forecast.atRiskEnvelopes.length
        ? `, at-risk envelope ids: ${forecast.atRiskEnvelopes.join(', ')}`
        : ', no envelopes currently at risk') +
      (forecast.recommendation
        ? `, existing cut recommendation: cut ${agorotToShekels(forecast.recommendation.cutAgorot)} ILS from "${forecast.recommendation.envelopeName}"`
        : ''),
    '',
    'Rules:',
    '- You may call get_envelopes, get_forecast, or get_recent_transactions if you need to double-check something — you already have the envelope list and forecast above, so this is rarely necessary.',
    '- Never do the final arithmetic yourself in words to the user — just reach a verdict and the numbers behind it; the app formats the final answer.',
    '- Only ever reference an envelope id that was given to you by get_envelopes or in the summary above — never invent one.',
    '- When picking which envelope to cut from (verdict over_budget), use your own judgment about which envelope name sounds discretionary vs. essential — there is no explicit essential/discretionary flag in the data, so read the name (and recent transactions if you fetch them) the way a careful human budgeter would. Do not just pick whichever envelope happens to have the most leftover room if a smaller-but-more-discretionary envelope would do.',
    '- Finish by calling provide_verdict exactly once — never answer in plain text instead.',
  ].join('\n');
}

function mapExplanationKey(verdict, amountAgorot, suggestion) {
  if (verdict === 'over_budget') {
    return suggestion ? 'advisor.reply.overBudgetWithSuggestion' : 'advisor.reply.overBudgetNoSuggestion';
  }
  if (verdict === 'near_limit') return 'advisor.reply.nearLimit';
  return amountAgorot != null ? 'advisor.reply.inBudget' : 'advisor.reply.inBudgetStatus';
}

/**
 * Answers a free-text budget question via a read-only tool-use loop over
 * the user's real envelopes/forecast — docs/features/AGENTS.md § Agent 1.
 * Never persists anything; if the user acts on the suggestion, that goes
 * through the existing envelope/transaction UI and endpoints.
 *
 * @param {number} userId
 * @param {string} text
 * @returns {Promise<{ verdict: 'in_budget'|'near_limit'|'over_budget', amountAgorot: number|null, projectedBalanceAfterAgorot: number|null, suggestion: {envelopeId:number, envelopeName:string, cutAgorot:number}|null, explanationKey: string }>}
 */
async function ask(userId, text) {
  const currentMonth = getCurrentMonth();

  // Fetched once, up front — both the tools' data source and this
  // function's own authoritative source for id revalidation + the JS-side
  // arithmetic below, so the model reasons over the exact numbers used in
  // the final calculation. Both already degrade to []/zeroed output for a
  // user with zero envelopes.
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
      tools,
      stopWhen: [stepCountIs(MAX_TOOL_LOOP_STEPS), hasToolCall('provide_verdict')],
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

  const answer = verdictCall.input;

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
  const suggestedEnvelopeId = validEnvelopeIds.has(answer.suggested_envelope_id) ? answer.suggested_envelope_id : null;
  const suggestion =
    suggestedEnvelopeId != null && answer.cut_shekels != null
      ? {
          envelopeId: suggestedEnvelopeId,
          envelopeName: envelopes.find((e) => e.id === suggestedEnvelopeId).name,
          cutAgorot: shekelsToAgorot(answer.cut_shekels),
        }
      : null;

  return {
    verdict: answer.verdict,
    amountAgorot,
    projectedBalanceAfterAgorot,
    suggestion,
    explanationKey: mapExplanationKey(answer.verdict, amountAgorot, suggestion),
  };
}

module.exports = { ask };
