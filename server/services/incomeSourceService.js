'use strict';

const { IncomeSource, sequelize } = require('../models');
const { normalizeMonth } = require('./envelopeService');

const PUBLIC_ATTRIBUTES = ['id', 'user_id', 'month', 'label', 'amount_agorot', 'sort_order'];

function totalAgorot(rows) {
  return rows.reduce((sum, row) => sum + row.amount_agorot, 0);
}

async function list(userId, monthInput) {
  const month = normalizeMonth(monthInput);

  const rows = await IncomeSource.findAll({
    where: { user_id: userId, month },
    attributes: PUBLIC_ATTRIBUTES,
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  const plainRows = rows.map((row) => row.get({ plain: true }));
  return { rows: plainRows, total_agorot: totalAgorot(plainRows) };
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
