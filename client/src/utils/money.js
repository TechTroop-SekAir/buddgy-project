// Mirrors server/utils/money.js — money is agorot end-to-end except at the
// UI boundary. See docs/STATE.md § Money at the Boundary.
import { getIntlLocale } from './locale';

/** @param {number} shekels */
export function shekelsToAgorot(shekels) {
  return Math.round(shekels * 100);
}

/** @param {number} agorot */
export function agorotToShekels(agorot) {
  return agorot / 100;
}

/** @param {number} agorot */
export function formatShekels(agorot) {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency: 'ILS',
  }).format(agorotToShekels(agorot));
}

// Zero-decimal variant for summary-altitude figures (stat tiles, the overall
// progress footnote, a card's budget subtitle) — never for a decision-
// relevant amount like a remaining/over-by balance, where rounding a few
// agorot to "₪0" would mislead. See docs/DASHBOARD-REDESIGN.md Step 3.
/** @param {number} agorot */
export function formatShekelsRounded(agorot) {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(agorotToShekels(agorot));
}
