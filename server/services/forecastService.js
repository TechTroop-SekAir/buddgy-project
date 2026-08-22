'use strict';

const { Op, fn, col } = require('sequelize');
const { Envelope, Transaction, PlannedExpense } = require('../models');
const { normalizeMonth } = require('./envelopeService');
const { monthRange } = require('../utils/month');

const EMPTY_FORECAST = {
  projectedBalanceAgorot: 0,
  atRiskEnvelopes: [],
  recommendation: null,
  totalActualSpentAgorot: 0,
  totalPlannedExpensesAgorot: 0,
  totalEndOfMonthSpendAgorot: 0,
  totalBudgetAgorot: 0,
  missingAmountPlannedExpenses: [],
};

const MISSING_AMOUNT_ATTRIBUTES = [
  'id',
  'envelope_id',
  'title',
  'amount_agorot',
  'due_date',
  'google_event_id',
  'is_confirmed',
  'source',
  'cost_likelihood',
];

/** COALESCE'd SUM as a plain number — Postgres returns SUM as a string, and COALESCE keeps an empty aggregate at 0 rather than null. */
async function sumAgorot(Model, column, where) {
  const [row] = await Model.findAll({
    where,
    attributes: [[fn('COALESCE', fn('SUM', col(column)), 0), 'total']],
    raw: true,
  });
  return Number(row.total);
}

/** Same COALESCE'd SUM, grouped by envelope_id — for per-envelope headroom. */
async function sumAgorotByEnvelope(Model, column, where) {
  const rows = await Model.findAll({
    where,
    attributes: ['envelope_id', [fn('COALESCE', fn('SUM', col(column)), 0), 'total']],
    group: ['envelope_id'],
    raw: true,
  });
  return Object.fromEntries(rows.map((r) => [r.envelope_id, Number(r.total)]));
}

/**
 * Aggregates, for the given user and month, the cash-flow forecast described
 * in docs/ARCHITECTURE.md § Forecast Computation:
 *   projectedBalanceAgorot = budget − actual spend − confirmed planned spend
 * `atRiskEnvelopes` are envelopes whose own projection goes negative under
 * the same math; `recommendation` names the envelope with the most headroom
 * to absorb the shortfall, or null if none exists / nothing is at risk.
 *
 * `recommendation` is a structured object, not a display sentence — docs/API.md
 * previously specified an English sentence, but the client defaults to Hebrew
 * (client/src/i18n.js), so the server hands over facts and the client
 * interpolates the translated wording (same pattern as errorMessages.js).
 */
async function get(userId, monthInput) {
  const month = normalizeMonth(monthInput);
  const { from, to } = monthRange(month);

  const envelopes = await Envelope.findAll({
    where: { user_id: userId, month },
    attributes: ['id', 'name', 'monthly_budget_agorot'],
    order: [['id', 'ASC']],
  });

  const overallActual = await sumAgorot(Transaction, 'amount_agorot', {
    user_id: userId,
    transaction_date: { [Op.between]: [from, to] },
  });
  // transaction_id: null excludes confirmed planned expenses that already
  // spawned a transaction (plannedExpenseService.js's update()) — their
  // amount is already counted via overallActual below. Filtering on the
  // link (not on is_confirmed) is what keeps a confirmed-but-unlinked row
  // (e.g. one confirmed before this link existed) still counted here.
  const overallPlanned = await sumAgorot(PlannedExpense, 'amount_agorot', {
    user_id: userId,
    is_confirmed: true,
    transaction_id: null,
    due_date: { [Op.between]: [from, to] },
  });
  const totalEndOfMonthSpendAgorot = overallActual + overallPlanned;

  // Step 8 of docs/ARCHITECTURE.md § Forecast Computation — surfaced as an
  // actionable prompt (MissingAmountPrompt.jsx) regardless of confirmation
  // state, since an unconfirmed row can still need its amount filled in
  // before the user ever gets to confirm it. Scoped to cost_likelihood:
  // 'likely' and not dismissed — since calendarSyncService now keeps every
  // event (not only amount-bearing ones), an unscoped query here would flood
  // this prompt with every gym session and standup on the calendar. See
  // docs/features/UPCOMING-EVENTS.md § Forecast Impact.
  const missingAmountPlannedExpenses = (
    await PlannedExpense.findAll({
      where: {
        user_id: userId,
        due_date: { [Op.between]: [from, to] },
        [Op.or]: [{ amount_agorot: null }, { amount_agorot: 0 }],
        cost_likelihood: 'likely',
        is_dismissed: false,
      },
      attributes: MISSING_AMOUNT_ATTRIBUTES,
      order: [['due_date', 'ASC'], ['id', 'ASC']],
      raw: true,
    })
  );

  if (!envelopes.length) {
    // Degrade gracefully rather than throw or divide by zero — docs/ARCHITECTURE.md
    // § Forecast Computation and .claude/commands/qa.md § Buddgy Critical Test Cases.
    if (overallActual === 0 && overallPlanned === 0 && missingAmountPlannedExpenses.length === 0) {
      return EMPTY_FORECAST;
    }
    return {
      projectedBalanceAgorot: -overallActual - overallPlanned,
      atRiskEnvelopes: [],
      recommendation: null,
      totalActualSpentAgorot: overallActual,
      totalPlannedExpensesAgorot: overallPlanned,
      totalEndOfMonthSpendAgorot,
      // No envelopes exist yet, so there's nothing budgeted — matches
      // totalBudget's own reduce() over an empty array below.
      totalBudgetAgorot: 0,
      missingAmountPlannedExpenses,
    };
  }

  const envelopeIds = envelopes.map((e) => e.id);
  const [spentByEnvelope, plannedByEnvelope] = await Promise.all([
    sumAgorotByEnvelope(Transaction, 'amount_agorot', {
      user_id: userId,
      envelope_id: { [Op.in]: envelopeIds },
      transaction_date: { [Op.between]: [from, to] },
    }),
    sumAgorotByEnvelope(PlannedExpense, 'amount_agorot', {
      user_id: userId,
      envelope_id: { [Op.in]: envelopeIds },
      is_confirmed: true,
      transaction_id: null,
      due_date: { [Op.between]: [from, to] },
    }),
  ]);

  const totalBudget = envelopes.reduce((sum, e) => sum + e.monthly_budget_agorot, 0);
  const projectedBalanceAgorot = totalBudget - overallActual - overallPlanned;

  const withHeadroom = envelopes.map((e) => ({
    id: e.id,
    name: e.name,
    headroom: e.monthly_budget_agorot - (spentByEnvelope[e.id] ?? 0) - (plannedByEnvelope[e.id] ?? 0),
  }));

  const atRiskEnvelopes = withHeadroom.filter((e) => e.headroom < 0).map((e) => e.id);

  let recommendation = null;
  if (projectedBalanceAgorot < 0) {
    const [best] = withHeadroom.filter((e) => e.headroom > 0).sort((a, b) => b.headroom - a.headroom);
    if (best) {
      recommendation = {
        envelopeId: best.id,
        envelopeName: best.name,
        cutAgorot: Math.min(best.headroom, -projectedBalanceAgorot),
      };
    }
  }

  return {
    projectedBalanceAgorot,
    atRiskEnvelopes,
    recommendation,
    totalActualSpentAgorot: overallActual,
    totalPlannedExpensesAgorot: overallPlanned,
    totalEndOfMonthSpendAgorot,
    // Sum of every envelope's monthly_budget_agorot — the "of ₪X budgeted"
    // line SummaryBar.jsx pairs with totalEndOfMonthSpendAgorot (docs/features/
    // HOMEPAGE-FIXES.md § 2.2: the tile previously showed actual+planned
    // spend with no budget figure to compare it against).
    totalBudgetAgorot: totalBudget,
    missingAmountPlannedExpenses,
  };
}

module.exports = { get };
