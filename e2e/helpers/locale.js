// Selectors are built from the app's real translation resources rather than
// hardcoded copy — he.json is the default locale (client/src/i18n.js), and
// there is no in-app language switcher, so every spec runs in Hebrew. This
// keeps tests from drifting out of sync with real copy changes.
const t = require('../../client/src/locales/he.json');

// Minimal stand-in for i18next's `{{var}}` interpolation — the app never
// needs plural/format logic in the strings these specs target, just
// substitution, so it isn't worth pulling in i18next itself here.
function interpolate(str, vars = {}) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

// Builds a regex from an i18next plural template (e.g. "{{count}} things")
// that matches any count — for asserting a pluralized string is showing
// without needing to predict which count it resolved to.
function pluralRegex(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped.replace(/\\\{\\\{count\\\}\\\}/, '\\d+'));
}

module.exports = { t, interpolate, pluralRegex };
