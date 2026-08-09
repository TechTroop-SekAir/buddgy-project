// Mirrors server/utils/money.js — money is agorot end-to-end except at the
// UI boundary. See docs/STATE.md § Money at the Boundary.

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
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(agorotToShekels(agorot));
}
