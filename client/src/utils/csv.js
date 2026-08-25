// Shared by ImportPage.jsx and onboarding/CsvImportStep.jsx — both build the
// column-mapping dropdowns from the server's parsed CSV header
// (importService.preview's `header`), never by re-parsing the file
// themselves (docs/fixes/... none; see the commit that added this: a naive
// client-side split() produced duplicate/blank column names and crashed
// Mantine's <Select>, and used UTF-8-only decoding that mismatched the
// server's windows-1255 fallback for Hebrew bank exports).

/**
 * Turns a raw CSV header into Select-ready options. Mantine's Select throws
 * on duplicate option values, and a blank column name can't be mapped to
 * anything meaningful — drop both.
 * @param {string[]} header
 */
export function toColumnOptions(header = []) {
  return [...new Set(header)]
    .filter((name) => name !== '')
    .map((name) => ({ value: name, label: name }));
}
