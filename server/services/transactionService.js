'use strict';

const { Op } = require('sequelize');
const { Transaction, Envelope, PlannedExpense, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { normalizeMonth } = require('./envelopeService');
const { monthRange } = require('../utils/month');

const PUBLIC_ATTRIBUTES = [
  'id',
  'user_id',
  'envelope_id',
  'amount_agorot',
  'description',
  'source',
  'transaction_date',
];

/** A caller may only ever point a transaction at their own envelope, or none. */
async function assertEnvelopeOwnership(userId, envelopeId) {
  if (envelopeId === null || envelopeId === undefined) return;
  const envelope = await Envelope.findOne({ where: { id: envelopeId, user_id: userId }, attributes: ['id'] });
  if (!envelope) throw new AppError('validation failed: envelope_id', 400);
}

async function list(userId, { month: monthInput, envelopeId }) {
  const month = normalizeMonth(monthInput);
  const { from, to } = monthRange(month);

  const where = { user_id: userId, transaction_date: { [Op.between]: [from, to] } };
  if (envelopeId !== undefined) where.envelope_id = envelopeId;

  const transactions = await Transaction.findAll({
    where,
    attributes: PUBLIC_ATTRIBUTES,
    order: [['transaction_date', 'DESC'], ['id', 'DESC']],
  });
  return transactions.map((t) => t.get({ plain: true }));
}

async function create(userId, { envelope_id = null, amount_agorot, description, transaction_date, source = 'manual' }) {
  await assertEnvelopeOwnership(userId, envelope_id);

  // 'csv' is only ever written by csvImportService.js's bulk import path;
  // 'quick_entry' is accepted here for the AI Quick Entry confirm step
  // (docs/API.md § AI Quick Entry: /parse never persists — this does, once
  // the user confirms). dedup_hash stays null — that UNIQUE column exists
  // for CSV re-upload idempotency only (docs/DATABASE.md § Idempotency);
  // Postgres allows unlimited NULLs in a UNIQUE column, so two identical
  // manual entries on the same day are never wrongly rejected.
  const transaction = await Transaction.create({
    user_id: userId,
    envelope_id,
    amount_agorot,
    description,
    source: source === 'quick_entry' ? 'quick_entry' : 'manual',
    transaction_date,
    dedup_hash: null,
  });
  return transaction.get({ plain: true });
}

async function findOwned(userId, id, { transaction: dbTransaction } = {}) {
  const transaction = await Transaction.findOne({
    where: { id, user_id: userId },
    attributes: PUBLIC_ATTRIBUTES,
    transaction: dbTransaction,
  });
  if (!transaction) throw new AppError('not found', 404);
  return transaction;
}

async function update(userId, id, patch) {
  const transaction = await findOwned(userId, id);
  const { envelope_id, amount_agorot, description, transaction_date } = patch;

  if (envelope_id !== undefined) await assertEnvelopeOwnership(userId, envelope_id);

  const fields = {};
  if (envelope_id !== undefined) fields.envelope_id = envelope_id;
  if (amount_agorot !== undefined) fields.amount_agorot = amount_agorot;
  if (description !== undefined) fields.description = description;
  if (transaction_date !== undefined) fields.transaction_date = transaction_date;

  await transaction.update(fields);
  return transaction.get({ plain: true });
}

/**
 * If this transaction is the one a planned expense's confirm created
 * (plannedExpenseService.js's update()), deleting it here must not leave
 * that row stuck at is_confirmed: true with a now-dangling transaction_id
 * (the FK is ON DELETE SET NULL, so the id alone would go stale silently).
 * Reverting to unconfirmed makes the row re-confirmable and lets
 * forecastService's transaction_id: null filter treat it as genuinely
 * unconfirmed rather than re-counting it as still-planned spend.
 */
async function remove(userId, id) {
  return sequelize.transaction(async (t) => {
    const transaction = await findOwned(userId, id, { transaction: t });

    await PlannedExpense.update(
      { is_confirmed: false, transaction_id: null },
      { where: { transaction_id: id, user_id: userId }, transaction: t }
    );

    await transaction.destroy({ transaction: t });
    return { id: transaction.id };
  });
}

module.exports = { list, create, update, remove };
