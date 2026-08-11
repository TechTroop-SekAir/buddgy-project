'use strict';

const { generateObject } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { z } = require('zod');
const AppError = require('../utils/AppError');
const { shekelsToAgorot } = require('../utils/money');

// Both Claude call sites live in this file and are never called directly
// from a controller — docs/INTEGRATIONS.md § Anthropic Claude API.

const MODEL_ID = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 512;

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
 * @param {string} text
 * @param {{ id: number, name: string }[]} envelopes - the caller's envelopes, for scoping the suggestion
 * @returns {Promise<{ amount_agorot: number, category: string, suggested_envelope_id: number|null, description: string, transaction_date: string, confidence: number }>}
 */
async function parseQuickEntry(text, envelopes) {
  const today = new Date().toISOString().slice(0, 10);
  const validEnvelopeIds = new Set(envelopes.map((e) => e.id));

  let object;
  try {
    ({ object } = await generateObject({
      model: anthropic(MODEL_ID),
      maxOutputTokens: MAX_TOKENS,
      schema: quickEntrySchema,
      prompt: buildPrompt(text, envelopes, today),
    }));
  } catch {
    // Timeout, rate limit, or the model's output didn't satisfy the schema
    // (generateObject throws NoObjectGeneratedError in that case) —
    // docs/INTEGRATIONS.md § Failure Handling. Never leak the raw SDK error.
    throw new AppError('unprocessable: ai parse failed', 422);
  }

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

module.exports = { parseQuickEntry };
