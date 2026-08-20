'use strict';

const { generateObject } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { z } = require('zod');
const { AiCall } = require('../models');
const AppError = require('../utils/AppError');
const { shekelsToAgorot } = require('../utils/money');

// Both Claude call sites live in this file and are never called directly
// from a controller — docs/INTEGRATIONS.md § Anthropic Claude API.

// claude-3-5-sonnet-20241022 was retired by Anthropic and now 404s
// (not_found_error) — discovered when classifyEventCostLikelihood's calls
// started failing 100% of the time in ai_calls. Every function in this file
// shares one model id, so this repairs Quick Entry and CSV mapping too.
const MODEL_ID = 'claude-sonnet-5';
const MAX_TOKENS = 512;
// classifyEventCostLikelihood's output scales with input size (one object
// per event, unlike the other two functions' fixed single-object output) —
// a real calendar's classification batch can be dozens of events (e.g.
// contacts-synced recurring birthdays), which overflows MAX_TOKENS and fails
// the whole call. calendarSyncService.js also chunks its batches so this
// never has to cover an unbounded event count on its own. Verified against
// real Google Calendar event ids (which run ~35-50 chars, longer for
// recurring-instance ids like "…_20260823"): a 15-event chunk measured
// ~1080 output tokens total — this model also spends output tokens on
// extended thinking before the JSON text (~470 of that 1080 was
// reasoning, not the answer itself), so the budget must cover both.
const EVENT_COST_MAX_TOKENS = 4000;
// A stalled connection must fail fast, not hang the request indefinitely —
// docs/INTEGRATIONS.md § Failure Handling.
const CLAUDE_TIMEOUT_MS = 15000;

function loadApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not set. See .env.example / CLAUDE.md § Environment Variables.');
  }
  return key;
}

// Read once at module load — fail fast rather than discovering a missing
// key only on the first request (server/utils/crypto.js does the same).
const anthropic = createAnthropic({ apiKey: loadApiKey() });

// Records usage for GET /api/admin/stats' aiCallCount (ticket B-08) — every
// real Anthropic call, including ones the user later abandons or that fail,
// since those still cost API spend. A logging failure must never break the
// AI feature itself (CLAUDE.md § Error Handling forbids silent swallowing,
// but this is the one place where the *caller's* request must still
// succeed/fail on its own merits regardless of whether the log write did).
async function logAiCall(userId, kind, succeeded) {
  try {
    await AiCall.create({ user_id: userId, kind, succeeded });
  } catch (err) {
    console.error('[claudeService] failed to record ai_calls row', err);
  }
}

// The model is asked for a decimal shekel amount, not agorot directly —
// models are unreliable at unit arithmetic, and all money must be stored
// as integer agorot (CLAUDE.md § Database Rules). Conversion happens once,
// in JS, right after generateObject returns.
const quickEntrySchema = z.object({
  amount_shekels: z.number().describe('The transaction amount in whole ILS shekels, as a decimal number, e.g. 34 or 34.5.'),
  category: z.string().describe('A short spending category label, e.g. "Cafes & Restaurants".'),
  suggested_envelope_id: z
    .number()
    .nullable()
    .describe('The id of the envelope this expense most likely belongs to, chosen only from the provided envelope list. null if none fit.'),
  description: z.string().describe('A short, human-readable description of the transaction.'),
  transaction_date: z
    .string()
    .describe('The transaction date in YYYY-MM-DD format. If the text implies no date, use the provided current date.'),
  confidence: z.number().min(0).max(1).describe('Confidence in this parse, from 0 to 1.'),
});

function buildPrompt(text, envelopes, today) {
  const envelopeList = envelopes.length
    ? envelopes.map((e) => `- id ${e.id}: ${e.name}`).join('\n')
    : '(the user has no envelopes yet)';

  return [
    `Today's date is ${today}.`,
    'Parse the following free-text expense entry into structured data.',
    'Only choose suggested_envelope_id from this list of the user\'s envelopes — never invent an id:',
    envelopeList,
    '',
    `Entry: "${text}"`,
  ].join('\n');
}

/**
 * Parses a free-text quick-entry string into a structured transaction
 * suggestion. Never persists anything — docs/API.md § AI Quick Entry.
 *
 * @param {number} userId - for GET /api/admin/stats' aiCallCount (ticket B-08)
 * @param {string} text
 * @param {{ id: number, name: string }[]} envelopes - the caller's envelopes, for scoping the suggestion
 * @returns {Promise<{ amount_agorot: number, category: string, suggested_envelope_id: number|null, description: string, transaction_date: string, confidence: number }>}
 */
async function parseQuickEntry(userId, text, envelopes) {
  const today = new Date().toISOString().slice(0, 10);
  const validEnvelopeIds = new Set(envelopes.map((e) => e.id));

  let object;
  try {
    ({ object } = await generateObject({
      model: anthropic(MODEL_ID),
      maxOutputTokens: MAX_TOKENS,
      schema: quickEntrySchema,
      prompt: buildPrompt(text, envelopes, today),
      abortSignal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    }));
  } catch {
    // Timeout, rate limit, or the model's output didn't satisfy the schema
    // (generateObject throws NoObjectGeneratedError in that case) —
    // docs/INTEGRATIONS.md § Failure Handling. Never leak the raw SDK error.
    await logAiCall(userId, 'quick_entry', false);
    throw new AppError('unprocessable: ai parse failed', 422);
  }
  await logAiCall(userId, 'quick_entry', true);

  const suggestedEnvelopeId = validEnvelopeIds.has(object.suggested_envelope_id)
    ? object.suggested_envelope_id
    : null;

  return {
    amount_agorot: shekelsToAgorot(object.amount_shekels),
    category: object.category,
    suggested_envelope_id: suggestedEnvelopeId,
    description: object.description,
    transaction_date: object.transaction_date,
    confidence: object.confidence,
  };
}

// The model is asked to map source column *names* (from the header row),
// never to touch the data itself — docs/INTEGRATIONS.md § Anthropic Claude
// API, point 2. Only a handful of sample rows are sent, never the whole file.
const columnMappingSchema = z.object({
  date: z.string().nullable().describe('The header name of the column containing the transaction date. null if none fits.'),
  amount: z.string().nullable().describe('The header name of the column containing the transaction amount. null if none fits.'),
  description: z.string().nullable().describe('The header name of the column containing a merchant/description. null if none fits.'),
});

function buildMappingPrompt(headerRow, sampleRows) {
  const sampleLines = sampleRows.map((row) => row.join(', ')).join('\n');
  return [
    'The following is the header row and a few sample rows from a bank statement CSV export.',
    'Map the columns to date, amount, and description by returning the exact header text for each — never invent a column name.',
    `Header row: ${headerRow.join(', ')}`,
    'Sample rows:',
    sampleLines,
  ].join('\n');
}

/**
 * Detects which CSV columns hold date/amount/description, from the header
 * row and a few sample rows only. Never reads or persists the full file —
 * docs/API.md § CSV Import.
 *
 * @param {number} userId - for GET /api/admin/stats' aiCallCount (ticket B-08)
 * @param {string[]} headerRow
 * @param {string[][]} sampleRows
 * @returns {Promise<{ date: string|null, amount: string|null, description: string|null }>}
 */
async function detectColumnMapping(userId, headerRow, sampleRows) {
  const validHeaders = new Set(headerRow);

  let object;
  try {
    ({ object } = await generateObject({
      model: anthropic(MODEL_ID),
      maxOutputTokens: MAX_TOKENS,
      schema: columnMappingSchema,
      prompt: buildMappingPrompt(headerRow, sampleRows),
      abortSignal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    }));
  } catch {
    // Timeout, rate limit, or malformed output — same failure contract as
    // parseQuickEntry. Never leak the raw SDK error.
    await logAiCall(userId, 'csv_mapping', false);
    throw new AppError('unprocessable: ai parse failed', 422);
  }
  await logAiCall(userId, 'csv_mapping', true);

  return {
    date: validHeaders.has(object.date) ? object.date : null,
    amount: validHeaders.has(object.amount) ? object.amount : null,
    description: validHeaders.has(object.description) ? object.description : null,
  };
}

// One event per line, tagged with google_event_id so the model's answers can
// be matched back up without trusting it to echo ids verbatim — matches the
// "never trust a model-returned id" posture the other two functions take.
const eventCostLikelihoodSchema = z.object({
  events: z.array(
    z.object({
      google_event_id: z.string(),
      likely_costly: z
        .boolean()
        .describe('true if this calendar event likely involves spending money (e.g. a wedding, birthday, flight, hotel), false for a routine free event (e.g. a meeting, gym session).'),
    })
  ),
});

function buildEventCostLikelihoodPrompt(events) {
  const eventLines = events.map((e) => `- google_event_id ${e.google_event_id}: "${e.title}"`).join('\n');
  return [
    'The following are upcoming Google Calendar event titles for a Hebrew-first budgeting app user.',
    'For each event, decide whether it likely involves spending money — a social/travel/purchase',
    'obligation such as a wedding, bar mitzva, birthday, flight, or hotel (חתונה, בר מצווה, יום הולדת,',
    'טיסה, מלון, קניות) counts as likely_costly: true. A routine free event such as a meeting, gym',
    'session, or standup (פגישה, חדר כושר) counts as likely_costly: false.',
    'Return one entry per event, using the exact google_event_id given — never invent one.',
    eventLines,
  ].join('\n');
}

/**
 * Classifies a batch of calendar events by whether they likely cost money,
 * for events whose title carries no parseable amount — one call per chunk
 * (calendarSyncService.js caps chunk size so this stays well under
 * EVENT_COST_MAX_TOKENS), not one call per event. Failure here must not fail
 * the whole sync — see docs/features/UPCOMING-EVENTS.md § Failure Handling;
 * callers should catch and treat the batch as unclassified rather than
 * letting this throw block calendarSyncService.
 *
 * @param {number} userId - for GET /api/admin/stats' aiCallCount (ticket B-08)
 * @param {{ google_event_id: string, title: string }[]} events
 * @returns {Promise<{ google_event_id: string, likely_costly: boolean }[]>}
 */
async function classifyEventCostLikelihood(userId, events) {
  if (events.length === 0) return [];

  const validEventIds = new Set(events.map((e) => e.google_event_id));

  let object;
  try {
    ({ object } = await generateObject({
      model: anthropic(MODEL_ID),
      maxOutputTokens: EVENT_COST_MAX_TOKENS,
      schema: eventCostLikelihoodSchema,
      prompt: buildEventCostLikelihoodPrompt(events),
      abortSignal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    }));
  } catch {
    // Timeout, rate limit, or malformed output — same failure contract as
    // the other two functions, but the caller (calendarSyncService) treats
    // this as non-fatal rather than surfacing a 422.
    await logAiCall(userId, 'event_cost', false);
    throw new AppError('unprocessable: ai parse failed', 422);
  }
  await logAiCall(userId, 'event_cost', true);

  // Drop any result for an id we didn't send — never trust a model-returned id.
  return object.events.filter((e) => validEventIds.has(e.google_event_id));
}

module.exports = { parseQuickEntry, detectColumnMapping, classifyEventCostLikelihood, logAiCall };
