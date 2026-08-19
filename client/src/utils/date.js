// Mirrors money.js/month.js — small pure helpers, no external date library.
import { getIntlLocale } from './locale';

/** @param {string} dateString ISO date, e.g. '2026-08-08' */
export function formatDate(dateString) {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
}

/** @param {string} month 'YYYY-MM-01' */
export function getMonthLabel(month) {
  return new Intl.DateTimeFormat(getIntlLocale(), { year: 'numeric', month: 'long' }).format(new Date(month));
}

/** @param {string} month 'YYYY-MM-01'; @param {number} delta months to shift, +/- */
export function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-01`;
}

/** @param {string} month 'YYYY-MM-01' — returns ISO min/max for date inputs bounded to that month */
export function getMonthBounds(month) {
  const [year, m] = month.split('-').map(Number);
  const start = month;
  const lastDay = new Date(year, m, 0).getDate();
  const end = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// Clamps to the target month's last day rather than overflowing into the
// month after (native `Date` would turn Jan 31 + 1 month into Mar 3) — used
// to generate one due_date per occurrence of a recurring planned expense.
/** @param {string} dateString 'YYYY-MM-DD'; @param {number} months >= 0 to add */
export function addMonthsToDate(dateString, months) {
  const [year, month, day] = dateString.split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const lastDayOfTargetMonth = new Date(year, targetMonthIndex + 1, 0).getDate();
  const date = new Date(year, targetMonthIndex, Math.min(day, lastDayOfTargetMonth));
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

// Only meaningful for the current month — a "days remaining" count for a
// past or future month has no real interpretation, so this returns null
// rather than a misleading number. See docs/DASHBOARD-REDESIGN.md Step 3.
/** @param {string} month 'YYYY-MM-01' @returns {number | null} */
export function getDaysRemainingInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === m;
  if (!isCurrentMonth) return null;
  const lastDay = new Date(year, m, 0).getDate();
  return lastDay - today.getDate();
}
