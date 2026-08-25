'use strict';

const { z } = require('zod');
const { MAX_REASONING_CHARS } = require('./constants');

// The loop's final step is itself a tool call — the AI SDK validates the
// model's arguments against this schema automatically (same guarantee
// generateObject gives parseQuickEntry: an invalid call throws, caught by
// ask()'s try/catch), so there's no separate follow-up call needed to
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
        'verdict is not over_budget, or no envelope has enough headroom to help. The app computes ' +
        'how much to cut itself — you only choose WHICH envelope.'
    ),
  // No cut_shekels field: how much to cut is arithmetic (shortfall capped at
  // the chosen envelope's headroom), computed in JS below from
  // suggestedEnvelopeId — never taken from the model, same rule as
  // amountAgorot's "Money math happens here, in JS" comment. A prior version
  // asked the model for this and got 100.00 vs 99.99 for an identical
  // question.
  reasoning_text: z
    .string()
    .max(MAX_REASONING_CHARS)
    .nullable()
    .describe(
      'A short free-text explanation, ONLY when the user is asking something conversational or ' +
        'explanatory about your MOST RECENT answer in this conversation (e.g. "why?", "how did you ' +
        'calculate that?", "explain that") rather than a new or repeated spending question. Write it ' +
        "in the same language as the user's question. When you set this, do NOT recompute anything — " +
        'restate the exact same verdict, amount_shekels, suggested_envelope_id, and cut_shekels you ' +
        'gave in your most recent answer, and use this field only to explain your reasoning in words. ' +
        'null for a new or repeated spending question with no prior answer to explain.'
    ),
});

const provideVerdictTool = {
  description:
    'Call this exactly once, as your final step, once you have enough information to answer — ' +
    "submits your structured verdict for the user's question. Do not call any other tool after this, " +
    'and never answer in plain text instead.',
  inputSchema: verdictSchema,
  execute: async (input) => input, // no side effect — exists purely to force a structured, validated final answer
};

module.exports = { verdictSchema, provideVerdictTool };
