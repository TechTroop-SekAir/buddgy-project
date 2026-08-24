'use strict';

const { ESSENTIAL_ENVELOPE_KEYWORDS } = require('./constants');

// True if the envelope's name matches any essential-spending keyword —
// such an envelope must never be suggested as a cut source, regardless of
// how much headroom it has. Two consumers, opposite roles: prompts.js uses
// this to *steer* the model away from these envelopes (the "[ESSENTIAL —
// ...]" flag in the system prompt), resolveVerdict.js uses it to *enforce*
// the rule regardless of what the model actually picks.
function isEssentialEnvelope(name) {
  const lower = (name || '').toLowerCase();
  return ESSENTIAL_ENVELOPE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

module.exports = { isEssentialEnvelope };
