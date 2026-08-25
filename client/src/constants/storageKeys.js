// localStorage keys shared across modules that would otherwise need to
// import each other in the wrong direction (e.g. services/api.js importing
// a context module). Keep in sync with the inline bootstrap script in
// index.html, which duplicates THEME_KEY as a literal (it runs before any
// module graph exists).
export const TOKEN_KEY = 'buddgy_token';
export const THEME_KEY = 'buddgy_theme';
