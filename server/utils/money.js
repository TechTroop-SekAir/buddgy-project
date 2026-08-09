'use strict';

// Money is stored as integers in agorot (1 ILS = 100 agorot) — never floats.
// Conversion to/from shekels happens only at the API/UI boundary.
// See CLAUDE.md § Database Rules and docs/STATE.md § Money at the Boundary.

/** @param {number} shekels */
function shekelsToAgorot(shekels) {
  return Math.round(shekels * 100);
}

/** @param {number} agorot */
function agorotToShekels(agorot) {
  return agorot / 100;
}

/** @param {number} agorot */
function formatShekels(agorot) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(agorotToShekels(agorot));
}

module.exports = { shekelsToAgorot, agorotToShekels, formatShekels };
