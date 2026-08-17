'use strict';

const { Op, fn, col } = require('sequelize');
const { Envelope, Transaction } = require('../models');
const AppError = require('../utils/AppError');
const { monthRange } = require('../utils/month');

// Envelopes are scoped to a single month (docs/DATABASE.md § envelopes,
// first-of-month convention) — every caller normalizes to that shape so a
// `DATEONLY` equality match ('2026-08-01') works whether the client sent
// '2026-08' (docs/API.md's documented shorthand) or '2026-08-01' (what
// client/src/utils/month.js's getCurrentMonth() actually sends).
const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;

function normalizeMonth(month) {
  if (!month || typeof month !== 'string' || !MONTH_RE.test(month)) {
    throw new AppError('validation failed: month', 400);
  }
  return month.length === 7 ? `${month}-01` : month;
}

const PUBLIC_ATTRIBUTES = ['id', 'user_id', 'name', 'monthly_budget_agorot', 'color', 'month'];

/**
 * Lists the caller's envelopes for a month, with `spent_agorot` computed
 * from `transactions` — there is no such column (see mockEnvelopeService.js's
 * header comment for why the client expects one anyway). Envelopes with no
 * transactions come back at 0, never null/undefined, so the client's
 * percentUsed math (client/src/utils/envelopeStatus.js) never divides into NaN.
 */
async function list(userId, monthInput) {
  const month = normalizeMonth(monthInput);

  const envelopes = await Envelope.findAll({
    where: { user_id: userId, month },
    attributes: PUBLIC_ATTRIBUTES,
    order: [['id', 'ASC']],
  });
  if (!envelopes.length) return [];

  const envelopeIds = envelopes.map((e) => e.id);
  const { from, to } = monthRange(month);
  const sums = await Transaction.findAll({
    where: {
      user_id: userId,
      envelope_id: { [Op.in]: envelopeIds },
      transaction_date: { [Op.between]: [from, to] },
    },
    attributes: ['envelope_id', [fn('COALESCE', fn('SUM', col('amount_agorot')), 0), 'spent_agorot']],
    group: ['envelope_id'],
    raw: true,
  });
  const spentByEnvelopeId = Object.fromEntries(sums.map((s) => [s.envelope_id, Number(s.spent_agorot)]));

  return envelopes.map((e) => ({ ...e.get({ plain: true }), spent_agorot: spentByEnvelopeId[e.id] ?? 0 }));
}

async function create(userId, { name, monthly_budget_agorot, color, month: monthInput }) {
  const month = normalizeMonth(monthInput);
  const envelope = await Envelope.create({ user_id: userId, name, monthly_budget_agorot, color, month });
  return { ...envelope.get({ plain: true }), spent_agorot: 0 };
}

/** Owner-scoped lookup shared by update/remove — 404, never 403, on a foreign id (docs/SECURITY.md § Row-Level Access). */
async function findOwned(userId, id) {
  const envelope = await Envelope.findOne({ where: { id, user_id: userId }, attributes: PUBLIC_ATTRIBUTES });
  if (!envelope) throw new AppError('not found', 404);
  return envelope;
}

async function update(userId, id, patch) {
  const envelope = await findOwned(userId, id);
  const { name, monthly_budget_agorot, color } = patch;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (monthly_budget_agorot !== undefined) fields.monthly_budget_agorot = monthly_budget_agorot;
  if (color !== undefined) fields.color = color;

  await envelope.update(fields);
  return envelope.get({ plain: true });
}

async function remove(userId, id) {
  const envelope = await findOwned(userId, id);
  await envelope.destroy();
  return { id: envelope.id };
}

module.exports = { list, create, update, remove, normalizeMonth };
