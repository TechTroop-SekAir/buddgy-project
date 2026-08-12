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
