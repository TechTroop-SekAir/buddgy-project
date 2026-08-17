'use strict';

const { Op, fn, col } = require('sequelize');
const { Envelope, Transaction, PlannedExpense } = require('../models');
const { normalizeMonth } = require('./envelopeService');
const { monthRange } = require('../utils/month');

const EMPTY_FORECAST = { projectedBalanceAgorot: 0, atRiskEnvelopes: [], recommendation: null };

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
  const overallPlanned = await sumAgorot(PlannedExpense, 'amount_agorot', {
    user_id: userId,
    is_confirmed: true,
    due_date: { [Op.between]: [from, to] },
  });

  if (!envelopes.length) {
    // Degrade gracefully rather than throw or divide by zero — docs/ARCHITECTURE.md
    // § Forecast Computation and .claude/commands/qa.md § Buddgy Critical Test Cases.
    if (overallActual === 0 && overallPlanned === 0) return EMPTY_FORECAST;
    return { projectedBalanceAgorot: -overallActual - overallPlanned, atRiskEnvelopes: [], recommendation: null };
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

  return { projectedBalanceAgorot, atRiskEnvelopes, recommendation };
}

module.exports = { get };
