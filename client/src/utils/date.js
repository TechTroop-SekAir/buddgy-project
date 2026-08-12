// Mirrors money.js/month.js — small pure helpers, no external date library.

/** @param {string} dateString ISO date, e.g. '2026-08-08' */
export function formatDate(dateString) {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
}

/** @param {string} month 'YYYY-MM-01' */
export function getMonthLabel(month) {
  return new Intl.DateTimeFormat('he-IL', { year: 'numeric', month: 'long' }).format(new Date(month));
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
