'use strict';

const { google } = require('googleapis');
const { sequelize, PlannedExpense } = require('../models');
const { shekelsToAgorot } = require('../utils/money');
const { getAuthedClient } = require('./googleCalendarService');
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
// planned_expenses, keyed on the UNIQUE google_event_id column so re-syncing
// never duplicates rows. Returns { newEvents }.
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

    const events = data.items || [];
    let newEvents = 0;

    await sequelize.transaction(async (transaction) => {
      for (const event of events) {
        const amountAgorot = extractAmountAgorot(event.summary);
        if (amountAgorot === null) continue; // no amount in title — skip, don't error

        const dueDate = event.start?.date || event.start?.dateTime?.slice(0, 10);
        if (!dueDate) continue;

        const [, created] = await PlannedExpense.findOrCreate({
          where: { google_event_id: event.id },
          defaults: {
            user_id: userId,
            title: event.summary,
            amount_agorot: amountAgorot,
            due_date: dueDate,
            google_event_id: event.id,
          },
          transaction,
        });

        // Re-syncing must not clobber a user's envelope assignment or
        // confirmation on an already-known event — only refresh title/amount/date.
        if (!created) {
          await PlannedExpense.update(
            { title: event.summary, amount_agorot: amountAgorot, due_date: dueDate },
            { where: { google_event_id: event.id }, transaction }
          );
        } else {
          newEvents += 1;
        }
      }
    });

    return { newEvents };
  } catch (err) {
    // A rate-limit, quota error, or transient outage mid-sync (after
    // getAuthedClient already succeeded) must not fall through to a
    // generic 500 — docs/INTEGRATIONS.md § Failure Handling.
    throw classifyGoogleApiError(err);
  }
}

module.exports = { syncPlannedExpenses, extractAmountAgorot, classifyGoogleApiError };
