'use strict';

const { z } = require('zod');
const transactionService = require('../transactionService');
const { agorotToShekels } = require('../../utils/money');

// Tools speak shekels, never agorot — the money-math-in-JS rule
// (parseQuickEntry's header comment) applies just as much to what we hand
// the model as to what we ask it to compute.
// Plain object literals, not the SDK's `tool()` helper — `tool()` is a
// pure identity function in this SDK version (exists only for TypeScript
// inference), so skipping it avoids a direct `require('ai')` here (see
// index.js's stepCountIs/hasToolCall comment) with no behavior difference.
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
        // as resolveVerdict's final-answer revalidation.
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

module.exports = { buildAdvisorTools };
