'use strict';

// Agent 1 — Budget Advisor (docs/features/AGENTS.md § Agent 1). Read-only
// tool-use loop: no tool here ever calls a write path. If the user acts on
// a suggestion, that goes through the existing envelope/transaction UI and
// endpoints — this agent only answers.
const MAX_TOOL_LOOP_STEPS = 3; // AGENTS.md § Risks — advisor-specific stop condition

// Bounds provide_verdict's reasoning_text the same way askBodySchema bounds
// the user's own input (server/routes/advisor.js) — a violation fails the
// existing zod-validation -> 422 path, same as any other malformed
// provide_verdict call.
const MAX_REASONING_CHARS = 600;

// Hardcoded essential-spending guardrail — kept in one place so it's easy to
// extend. The model reads envelope *names* to judge discretionary vs.
// essential (there's no such flag in the data — see verdictSchema's
// suggested_envelope_id description and the prompt rule below), and that
// judgment alone already picked a vague-but-possibly-essential envelope
// once ("הוצאות כלליות" / "General expenses"). This blocklist is a hard
// floor under that judgment, not a replacement for it: envelope names
// matching it are excluded from the cut-candidate set before the model ever
// sees them as an option, and re-checked in JS below (same
// never-trust-the-model-on-a-guarantee posture as the id-validity guard).
// Case-insensitive substring match against the envelope name; Hebrew and
// English side by side.
const ESSENTIAL_ENVELOPE_KEYWORDS = [
  // English
  'rent',
  'mortgage',
  'utilities',
  'utility',
  'insurance',
  'groceries',
  'grocery',
  'bills',
  'bill',
  'electricity',
  'water',
  // Hebrew
  'שכירות',
  'משכנתא',
  'חשמל',
  'ארנונה',
  'ביטוח',
  'מחיה',
  'חשבונות',
  'מים',
  'ועד בית',
];

module.exports = { MAX_TOOL_LOOP_STEPS, MAX_REASONING_CHARS, ESSENTIAL_ENVELOPE_KEYWORDS };
