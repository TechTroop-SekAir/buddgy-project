'use strict';

const { Op } = require('sequelize');
const { PlannedExpense, Envelope, Transaction, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { normalizeMonth } = require('./envelopeService');
const { monthRange } = require('../utils/month');

const PUBLIC_ATTRIBUTES = [
  'id',
  'user_id',
  'envelope_id',
  'title',
  'amount_agorot',
  'due_date',
  'google_event_id',
  'is_confirmed',
  'source',
  'cost_likelihood',
  'is_dismissed',
  'transaction_id',
];

/** A caller may only ever point a planned expense at their own envelope, or none. */
async function assertEnvelopeOwnership(userId, envelopeId) {
  if (envelopeId === null || envelopeId === undefined) return;
  const envelope = await Envelope.findOne({ where: { id: envelopeId, user_id: userId }, attributes: ['id'] });
  if (!envelope) throw new AppError('validation failed: envelope_id', 400);
}

async function create(userId, { envelope_id = null, title, amount_agorot, due_date }) {
  await assertEnvelopeOwnership(userId, envelope_id);

  const plannedExpense = await PlannedExpense.create({
    user_id: userId,
    envelope_id,
    title,
    amount_agorot,
    due_date,
    google_event_id: null,
    is_confirmed: false,
    source: 'manual',
    // A manually-added row is unambiguously something the user wants
    // tracked — unlike a calendar-synced row, which is what
    // cost_likelihood's 'unknown' default and forecastService.js's
    // missing-amount filter were designed to gate on (docs/features/
    // UPCOMING-EVENTS.md § Forecast Impact). Without this, a manual entry
    // with no amount yet silently never appears in MissingAmountPrompt.
    cost_likelihood: 'likely',
  });
  return plannedExpense.get({ plain: true });
}

// By default, a dismissed row ("this won't cost money") is hidden from the
// month's list — the client's "show dismissed" toggle passes includeDismissed
// to see everything, e.g. to offer undo. See docs/features/UPCOMING-EVENTS.md.
async function list(userId, monthInput, { includeDismissed = false } = {}) {
  const month = normalizeMonth(monthInput);
  const { from, to } = monthRange(month);

  const where = { user_id: userId, due_date: { [Op.between]: [from, to] } };
  if (!includeDismissed) where.is_dismissed = false;

  const plannedExpenses = await PlannedExpense.findAll({
    where,
    attributes: PUBLIC_ATTRIBUTES,
    order: [['due_date', 'ASC'], ['id', 'ASC']],
  });
  return plannedExpenses.map((p) => p.get({ plain: true }));
}

/**
 * Owner-scoped lookup shared by update/remove — 404, never 403, on a foreign
 * id (docs/SECURITY.md § Row-Level Access). `update()` passes `transaction`
 * and `lock` so the row is read-locked for the duration of its DB
 * transaction, guarding against a double-submit race where two concurrent
 * confirms could otherwise both observe `is_confirmed: false`.
 */
async function findOwned(userId, id, { transaction, lock } = {}) {
  const plannedExpense = await PlannedExpense.findOne({
    where: { id, user_id: userId },
    attributes: PUBLIC_ATTRIBUTES,
    transaction,
    lock,
  });
  if (!plannedExpense) throw new AppError('not found', 404);
  return plannedExpense;
}

/**
 * Confirming a planned expense atomically creates the corresponding
 * `transactions` row (source: 'planned_expense', dated on `due_date`) so it
 * counts as real spend on its envelope — see docs/ARCHITECTURE.md § Forecast
 * Computation. Unconfirming reverses this by deleting that transaction.
 * Both the row update and the transaction create/delete share one DB
 * transaction, so a failure at any step leaves nothing partially applied.
 */
async function update(userId, id, patch) {
  const { envelope_id, title, amount_agorot, due_date, is_confirmed, is_dismissed } = patch;

  return sequelize.transaction(async (t) => {
    const plannedExpense = await findOwned(userId, id, { transaction: t, lock: t.LOCK.UPDATE });

    if (envelope_id !== undefined) await assertEnvelopeOwnership(userId, envelope_id);

    // Transition-based, not "is_confirmed is true in the patch" — this is
    // what makes re-confirming an already-confirmed row a no-op rather than
    // creating a second transaction.
    const isConfirming = is_confirmed === true && !plannedExpense.is_confirmed;
    const isUnconfirming = is_confirmed === false && plannedExpense.is_confirmed;

    const fields = {};
    if (envelope_id !== undefined) fields.envelope_id = envelope_id;
    if (title !== undefined) fields.title = title;
    if (amount_agorot !== undefined) fields.amount_agorot = amount_agorot;
    if (due_date !== undefined) fields.due_date = due_date;
    if (is_confirmed !== undefined) fields.is_confirmed = is_confirmed;
    if (is_dismissed !== undefined) fields.is_dismissed = is_dismissed;

    if (isConfirming) {
      // A single PATCH may change the amount/envelope/etc. and confirm in
      // the same call — resolve against the patch first, the existing row
      // otherwise.
      const finalAmount = amount_agorot !== undefined ? amount_agorot : plannedExpense.amount_agorot;
      // amount_agorot is nullable on planned_expenses (missing-amount rows
      // are a real state, docs/ARCHITECTURE.md step 8) but NOT NULL on
      // transactions — nothing upstream of this guards that mismatch.
      if (!finalAmount || finalAmount <= 0) {
        throw new AppError('validation failed: amount_agorot', 400);
      }
      const finalEnvelopeId = envelope_id !== undefined ? envelope_id : plannedExpense.envelope_id;
      const finalTitle = title !== undefined ? title : plannedExpense.title;
      const finalDueDate = due_date !== undefined ? due_date : plannedExpense.due_date;

      const transaction = await Transaction.create(
        {
          user_id: userId,
          envelope_id: finalEnvelopeId,
          amount_agorot: finalAmount,
          description: finalTitle,
          source: 'planned_expense',
          transaction_date: finalDueDate,
          // dedup_hash is scoped to CSV re-import idempotency only
          // (transactionService.create() does the same for every
          // non-CSV source) — Postgres allows unlimited NULLs in a
          // UNIQUE column, so this never collides.
          dedup_hash: null,
        },
        { transaction: t }
      );
      fields.transaction_id = transaction.id;
    }

    if (isUnconfirming && plannedExpense.transaction_id) {
      await Transaction.destroy({
        where: { id: plannedExpense.transaction_id, user_id: userId },
        transaction: t,
      });
      fields.transaction_id = null;
    }

    // Editing an *already*-confirmed row (envelope/amount/title/due_date,
    // is_confirmed absent from the patch) previously left the linked
    // transaction untouched — the transaction is what envelope spend and
    // the forecast actually read, so it silently drifted from what the
    // planned-expense row showed. Mirror the same field changes onto it.
    if (!isConfirming && !isUnconfirming && plannedExpense.is_confirmed && plannedExpense.transaction_id) {
      // amount_agorot is already positive-validated by updateBodySchema
      // (routes/plannedExpenses.js) when present — no extra guard needed
      // here, unlike the isConfirming branch above, which has to fall back
      // to the row's own (possibly null) amount_agorot.
      const transactionFields = {};
      if (envelope_id !== undefined) transactionFields.envelope_id = envelope_id;
      if (amount_agorot !== undefined) transactionFields.amount_agorot = amount_agorot;
      if (title !== undefined) transactionFields.description = title;
      if (due_date !== undefined) transactionFields.transaction_date = due_date;

      if (Object.keys(transactionFields).length > 0) {
        await Transaction.update(transactionFields, {
          where: { id: plannedExpense.transaction_id, user_id: userId },
          transaction: t,
        });
      }
    }

    await plannedExpense.update(fields, { transaction: t });
    return plannedExpense.get({ plain: true });
  });
}

/**
 * Symmetric with unconfirming (which deletes the linked transaction,
 * docs/DATABASE.md § Idempotency) — deleting a confirmed row must also
 * remove the money it represents, or the transaction is orphaned: it keeps
 * source: 'planned_expense' but nothing points at it anymore, and it stays
 * on the envelope's spend forever with no way back to the planning record.
 */
async function remove(userId, id) {
  return sequelize.transaction(async (t) => {
    const plannedExpense = await findOwned(userId, id, { transaction: t, lock: t.LOCK.UPDATE });

    if (plannedExpense.transaction_id) {
      await Transaction.destroy({
        where: { id: plannedExpense.transaction_id, user_id: userId },
        transaction: t,
      });
    }

    await plannedExpense.destroy({ transaction: t });
    return { id: plannedExpense.id };
  });
}

module.exports = { create, list, update, remove };
