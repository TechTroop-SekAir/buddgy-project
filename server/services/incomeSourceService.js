'use strict';

const { Op } = require('sequelize');
const { IncomeSource, sequelize } = require('../models');
const { normalizeMonth } = require('./envelopeService');

const PUBLIC_ATTRIBUTES = ['id', 'user_id', 'month', 'label', 'amount_agorot', 'sort_order'];

function totalAgorot(rows) {
  return rows.reduce((sum, row) => sum + row.amount_agorot, 0);
}

/**
 * fallback: 'previous' backs Settings' income editor — a month with no rows
 * yet is prefilled from the most recent earlier month with data, so a new
 * month doesn't start the user at a blank form (and, until they save, the
 * homepage's real ₪0 for that month). Prefilled rows carry `id: null` since
 * they aren't this month's persisted rows yet — saving them is what makes
 * them real via `replace`. Callers that omit `fallback` (DashboardPage) are
 * unaffected: an empty month still returns `{ rows: [], total_agorot: 0 }`.
 */
async function list(userId, monthInput, fallback) {
  const month = normalizeMonth(monthInput);

  const rows = await IncomeSource.findAll({
    where: { user_id: userId, month },
    attributes: PUBLIC_ATTRIBUTES,
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  let plainRows = rows.map((row) => row.get({ plain: true }));
  let carriedFrom = null;

  if (plainRows.length === 0 && fallback === 'previous') {
    const previous = await IncomeSource.findAll({
      where: { user_id: userId, month: { [Op.lt]: month } },
      attributes: PUBLIC_ATTRIBUTES,
      order: [['month', 'DESC'], ['sort_order', 'ASC'], ['id', 'ASC']],
    });
    const plainPrevious = previous.map((row) => row.get({ plain: true }));
    if (plainPrevious.length > 0) {
      carriedFrom = plainPrevious[0].month;
      plainRows = plainPrevious
        .filter((row) => row.month === carriedFrom)
        .map((row) => ({ ...row, id: null, month }));
    }
  }

  const result = { rows: plainRows, total_agorot: totalAgorot(plainRows) };
  // Only shape-change the response when a caller opted into fallback — keeps
  // DashboardPage's plain `{ rows, total_agorot }` contract byte-for-byte
  // unchanged (see incomeSources.integration.test.js's toEqual assertions).
  if (fallback === 'previous') result.carried_from = carriedFrom;
  return result;
}

/**
 * Full-month replace, matching client/src/services/mockIncomeService.js's
 * contract (the agreed shape the onboarding wizard and Dashboard were built
 * against): every existing row for the month is discarded and replaced with
 * exactly the rows sent, in the order given. Wrapped in one DB transaction
 * per CLAUDE.md's multi-step-write rule — a failure partway through must not
 * leave the month with only some of its old rows destroyed.
 */
async function replace(userId, monthInput, rowsInput) {
  const month = normalizeMonth(monthInput);
  const rows = Array.isArray(rowsInput) ? rowsInput : [];

  const plainRows = await sequelize.transaction(async (t) => {
    await IncomeSource.destroy({ where: { user_id: userId, month }, transaction: t });

    if (rows.length === 0) return [];

    const created = await IncomeSource.bulkCreate(
      rows.map((row, index) => ({
        user_id: userId,
        month,
        label: row.label,
        amount_agorot: row.amount_agorot,
        sort_order: index,
      })),
      { transaction: t, returning: true }
    );
    return created.map((row) => row.get({ plain: true }));
  });

  return { rows: plainRows, total_agorot: totalAgorot(plainRows) };
}

module.exports = { list, replace };
