// Dependency-free fallback for when server/services/claudeService.js
// (Anthropic) is unavailable — extracts an amount and leftover description
// with a regex instead of blocking the user. Mirrors the currency-word set
// the project's old mock parser used (₪, ils, shekel(s), שקל/שקלים).
const AMOUNT_PATTERN = /₪?\s*(\d+(?:\.\d+)?)\s*(?:₪|ils|shekels?|שקל|שקלים)?/i;

export function parseQuickEntryText(text) {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;

  const amountShekels = Number(match[1]);
  if (!(amountShekels > 0)) return null;

  const description = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/\s+/g, ' ')
    .trim();

  return { amountShekels, description: description || text.trim() };
}
