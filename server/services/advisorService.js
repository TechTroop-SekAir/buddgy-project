'use strict';

const claudeService = require('../services/claudeService');

// Transport-layer seam for Agent 1 — Budget Advisor (docs/features/AGENTS.md
// § Agent 1). This ticket only wires the client -> API -> server round trip;
// A-21 replaces this function's body with the real tool-use loop (get_envelopes,
// get_forecast, get_recent_transactions) without touching the signature, the
// response contract, or any caller. Never exposes a write tool — read-only by
// design, same as the eventual agent.
//
// `explanationKey` (not a Hebrew `explanation` string as AGENTS.md's draft
// schema shows) — the server has no locale; client/CLAUDE.md's i18n rule
// forbids server-authored user-facing strings. Mirrors forecastService's
// `recommendation`, which is structured data the client words itself.
//
// @param {number} userId
// @param {string} text
// @returns {Promise<{ verdict: 'in_budget'|'near_limit'|'over_budget', amountAgorot: number|null, projectedBalanceAfterAgorot: number|null, suggestion: null, explanationKey: string }>}
async function ask(userId, text) {
  void text; // unused until A-21's tool loop reads it
  await claudeService.logAiCall(userId, 'budget_advisor', true);

  return {
    verdict: 'in_budget',
    amountAgorot: null,
    projectedBalanceAfterAgorot: null,
    suggestion: null,
    explanationKey: 'advisor.reply.notConnected',
  };
}

module.exports = { ask };
