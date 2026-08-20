'use strict';

const { google } = require('googleapis');
const { Op } = require('sequelize');
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

  // Scoped to the fetch only — a failure past this point (classification,
  // the DB transaction below) is an internal error, not a Google outage, and
  // must not be relabeled as one. See docs/INTEGRATIONS.md § Failure Handling.
  let data;
  try {
    ({ data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: MAX_EVENTS_PER_SYNC,
    }));
  } catch (err) {
    throw classifyGoogleApiError(err);
  }

  const events = (data.items || [])
    .map((event) => ({
      event,
      amountAgorot: extractAmountAgorot(event.summary),
      dueDate: event.start?.date || event.start?.dateTime?.slice(0, 10),
    }))
    .filter((e) => e.dueDate); // an event with no date at all can't become a planned expense

  // Classification is sticky: once a row has left 'unknown' (whether by
  // amount extraction or a prior successful classify), no later sync ever
  // touches it again — only is_dismissed/is_confirmed (explicit user
  // actions) can move it out of Upcoming Events after that. Without this,
  // a transient classifier failure on a later sync would silently flip an
  // already-'likely' row back to 'unknown' and it would vanish from the
  // list with no user action — see docs/features/UPCOMING-EVENTS.md § Sync.
  const existingRows = await PlannedExpense.findAll({
    where: { user_id: userId, google_event_id: { [Op.in]: events.map((e) => e.event.id) } },
    attributes: ['google_event_id', 'cost_likelihood'],
  });
  const priorLikelihoodByEventId = new Map(existingRows.map((r) => [r.google_event_id, r.cost_likelihood]));

  // An event whose title already carries an amount is 'likely' without
  // needing a model call. Everything else — that's still undecided — is
  // classified in chunked Claude calls (not one per event, and not one
  // giant call for the whole sync either): a single generateObject call's
  // output scales with how many events are in it, and a busy calendar
  // (e.g. contacts-synced recurring birthdays) can easily put 50+ events
  // in one sync, which overflows the output token budget and fails the
  // whole batch at once. Chunking bounds each call's output size and
  // means one bad chunk degrades only its own events to 'unknown'
  // (retried next sync) instead of blocking every event in the sync.
  const CLASSIFY_CHUNK_SIZE = 15;
  const toClassify = events.filter(
    (e) => e.amountAgorot === null && (priorLikelihoodByEventId.get(e.event.id) ?? 'unknown') === 'unknown'
  );
  const likelihoodByEventId = new Map();
  for (let i = 0; i < toClassify.length; i += CLASSIFY_CHUNK_SIZE) {
    const chunk = toClassify.slice(i, i + CLASSIFY_CHUNK_SIZE);
    try {
      const results = await classifyEventCostLikelihood(
        userId,
        chunk.map((e) => ({ google_event_id: e.event.id, title: e.event.summary || '' }))
      );
      for (const r of results) likelihoodByEventId.set(r.google_event_id, r.likely_costly);
    } catch {
      // This chunk's events stay 'unknown' below and are retried next
      // sync — docs/INTEGRATIONS.md § Failure Handling. Other chunks are
      // unaffected since each has its own try/catch.
    }
  }

  let newEvents = 0;
  let likelyCostly = 0;

  await sequelize.transaction(async (transaction) => {
    for (const { event, amountAgorot, dueDate } of events) {
      // Only a genuinely new determination for *this* sync — never
      // recomputed from a prior 'likely'/'unlikely' value.
      const freshLikelihood =
        amountAgorot !== null
          ? 'likely'
          : likelihoodByEventId.has(event.id)
            ? (likelihoodByEventId.get(event.id) ? 'likely' : 'unlikely')
            : null; // no new data this sync

      const priorLikelihood = priorLikelihoodByEventId.get(event.id) ?? 'unknown';
      const wasUnknown = priorLikelihood === 'unknown';
      // 'unknown' for a brand-new row, freshLikelihood for a row moving
      // out of 'unknown' this sync, otherwise whatever it already was.
      const currentLikelihood = wasUnknown ? (freshLikelihood ?? 'unknown') : priorLikelihood;
      if (currentLikelihood === 'likely') likelyCostly += 1;

      const [, created] = await PlannedExpense.findOrCreate({
        where: { user_id: userId, google_event_id: event.id },
        defaults: {
          user_id: userId,
          title: event.summary,
          amount_agorot: amountAgorot,
          due_date: dueDate,
          google_event_id: event.id,
          cost_likelihood: currentLikelihood,
        },
        transaction,
      });

      // Re-syncing must not clobber a user's envelope assignment,
      // confirmation, or dismissal on an already-known event — only
      // refresh title/amount/date. cost_likelihood is only ever set here
      // when freshLikelihood exists AND the row was still 'unknown'
      // (sticky-once-classified, see above).
      // Scoped by user_id too: Google reuses the same event id across every
      // attendee of a shared event, and google_event_id is only unique per
      // user (see the scope-google-event-id-unique migration) — without
      // this, one user's sync could read/overwrite another user's row.
      if (!created) {
        const fields = { title: event.summary, amount_agorot: amountAgorot, due_date: dueDate };
        if (freshLikelihood && wasUnknown) {
          fields.cost_likelihood = freshLikelihood;
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
}

module.exports = { syncPlannedExpenses, extractAmountAgorot, classifyGoogleApiError };
