'use strict';

const { google } = require('googleapis');
const { sequelize, PlannedExpense } = require('../models');
const { shekelsToAgorot } = require('../utils/money');
const { getAuthedClient } = require('./googleCalendarService');
const { classifyEventCostLikelihood } = require('./claudeService');
const AppError = require('../utils/AppError');

// How far ahead to pull events on each sync — named per CLAUDE.md § Non-Negotiables
// (no magic numbers).
const MAX_EVENTS_PER_SYNC = 50;

// Matches "₪120", "120 ILS", "120.50 NIS", "Rent 4500" — a currency symbol/code
// is optional but there must be a number. docs/INTEGRATIONS.md § Google Calendar
// API: an event with no parseable amount is skipped, not errored.
const AMOUNT_PATTERN = /(?:₪|ILS|NIS)\s*([\d,]+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:₪|ILS|NIS)/i;

function extractAmountAgorot(title) {
  if (!title) return null;

  const match = title.match(AMOUNT_PATTERN);
  if (!match) return null;

  const numeric = (match[1] || match[2]).replace(/,/g, '');
  const shekels = Number(numeric);
  if (!Number.isFinite(shekels)) return null;

  return shekelsToAgorot(shekels);
}

/**
 * Maps a googleapis error to a client-safe AppError, per
 * docs/INTEGRATIONS.md § Failure Handling. An AppError already thrown
 * upstream (e.g. by getAuthedClient) is passed through untouched.
 * @param {*} err
 */
function classifyGoogleApiError(err) {
  if (err instanceof AppError) return err;

  const status = err?.code ?? err?.response?.status;
  if (status === 401 || status === 403) {
    return new AppError('Google Calendar access was revoked. Please reconnect.', 401);
  }
  if (status === 429) {
    return new AppError('Google Calendar is rate-limited. Try again shortly.', 429);
  }
  return new AppError('Google Calendar is temporarily unavailable. Try again shortly.', 502);
}

// Fetches upcoming Google Calendar events for the user and upserts them into
// planned_expenses, keyed on the UNIQUE (user_id, google_event_id) pair so
// re-syncing never duplicates rows and two users invited to the same event
// each get their own row. Unlike the pre-classification version, every event
// is kept (not only ones with an amount in the title) — see
// docs/features/UPCOMING-EVENTS.md. Returns { newEvents, likelyCostly }.
async function syncPlannedExpenses(userId) {
  const authedClient = await getAuthedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth: authedClient });

  try {
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: MAX_EVENTS_PER_SYNC,
    });

    const events = (data.items || [])
      .map((event) => ({
        event,
        amountAgorot: extractAmountAgorot(event.summary),
        dueDate: event.start?.date || event.start?.dateTime?.slice(0, 10),
      }))
      .filter((e) => e.dueDate); // an event with no date at all can't become a planned expense

    // An event whose title already carries an amount is 'likely' without
    // needing a model call. Everything else is batched into one Claude call
    // per sync (not one per event) — a classifier failure must not fail the
    // sync (docs/INTEGRATIONS.md § Failure Handling), so it's caught here and
    // those events just stay 'unknown'.
    const toClassify = events.filter((e) => e.amountAgorot === null);
    let likelihoodByEventId = new Map();
    if (toClassify.length > 0) {
      try {
        const results = await classifyEventCostLikelihood(
          userId,
          toClassify.map((e) => ({ google_event_id: e.event.id, title: e.event.summary || '' }))
        );
        likelihoodByEventId = new Map(results.map((r) => [r.google_event_id, r.likely_costly]));
      } catch {
        // Leave likelihoodByEventId empty — those events resolve to 'unknown' below.
      }
    }

    let newEvents = 0;
    let likelyCostly = 0;

    await sequelize.transaction(async (transaction) => {
      for (const { event, amountAgorot, dueDate } of events) {
        const costLikelihood =
          amountAgorot !== null
            ? 'likely'
            : likelihoodByEventId.has(event.id)
              ? (likelihoodByEventId.get(event.id) ? 'likely' : 'unlikely')
              : 'unknown';
        if (costLikelihood === 'likely') likelyCostly += 1;

        const [record, created] = await PlannedExpense.findOrCreate({
          where: { user_id: userId, google_event_id: event.id },
          defaults: {
            user_id: userId,
            title: event.summary,
            amount_agorot: amountAgorot,
            due_date: dueDate,
            google_event_id: event.id,
            cost_likelihood: costLikelihood,
          },
          transaction,
        });

        // Re-syncing must not clobber a user's envelope assignment,
        // confirmation, or dismissal on an already-known event — only
        // refresh title/amount/date, and cost_likelihood only while the row
        // is still undecided (docs/features/UPCOMING-EVENTS.md § Sync).
        // Scoped by user_id too: Google reuses the same event id across every
        // attendee of a shared event, and google_event_id is only unique per
        // user (see the scope-google-event-id-unique migration) — without
        // this, one user's sync could read/overwrite another user's row.
        if (!created) {
          const fields = { title: event.summary, amount_agorot: amountAgorot, due_date: dueDate };
          if (!record.is_dismissed && !record.is_confirmed) {
            fields.cost_likelihood = costLikelihood;
          }
          await PlannedExpense.update(fields, {
            where: { user_id: userId, google_event_id: event.id },
            transaction,
          });
        } else {
          newEvents += 1;
        }
      }
    });

    return { newEvents, likelyCostly };
  } catch (err) {
    // A rate-limit, quota error, or transient outage mid-sync (after
    // getAuthedClient already succeeded) must not fall through to a
    // generic 500 — docs/INTEGRATIONS.md § Failure Handling.
    throw classifyGoogleApiError(err);
  }
}

module.exports = { syncPlannedExpenses, extractAmountAgorot, classifyGoogleApiError };
