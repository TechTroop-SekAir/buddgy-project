'use strict';

const crypto = require('crypto');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');
const { CsvImport, Transaction, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { shekelsToAgorot } = require('../utils/money');
const storageService = require('./storageService');
const claudeService = require('../services/claudeService');

// docs/API.md § CSV Import + docs/PLAN.md § Risks: Hebrew bank exports, BOM,
// and ',' vs ';' delimiters must not silently drop rows.

const PREVIEW_ROW_COUNT = 10;
const SAMPLE_ROW_COUNT_FOR_AI = 5;
// A stalled re-read of the stored file must fail fast, not hang the request
// indefinitely — docs/INTEGRATIONS.md § Failure Handling.
const FILE_FETCH_TIMEOUT_MS = 30000;

/**
 * Decodes a CSV file's bytes to text, stripping a UTF-8 BOM and falling
 * back to windows-1255 (the common Israeli bank export encoding) when the
 * bytes aren't valid UTF-8 — docs/PLAN.md § Risks.
 * @param {Buffer} buffer
 */
function decodeCsvBuffer(buffer) {
  let buf = buffer;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.subarray(3);
  }
  const utf8Text = buf.toString('utf8');
  if (utf8Text.includes('�')) {
    return iconv.decode(buf, 'windows-1255');
  }
  return utf8Text;
}

/** Sniffs ',' vs ';' from the header line — docs/PLAN.md § Risks. */
function sniffDelimiter(firstLine) {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parses raw CSV bytes into a header row + data rows (arrays of strings).
 * @param {Buffer} buffer
 * @returns {{ headerRow: string[], rows: string[][] }}
 */
function parseCsvBuffer(buffer) {
  const text = decodeCsvBuffer(buffer);
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = sniffDelimiter(firstLine);

  let records;
  try {
    records = parse(text, { delimiter, skip_empty_lines: true, trim: true });
  } catch {
    throw new AppError('validation failed: file could not be parsed as CSV', 400);
  }
  if (!records.length) {
    throw new AppError('validation failed: file has no rows', 400);
  }

  const [headerRow, ...rows] = records;
  return { headerRow, rows };
}

/**
 * Parses a bank amount string into shekels — handles thousand separators,
 * parenthesised negatives, and currency symbols.
 * @param {string} raw
 * @returns {number}
 */
function parseAmountToShekels(raw) {
  let s = String(raw ?? '').trim();
  if (!s) throw new AppError('validation failed: unparseable amount', 400);

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[^\d.,]/g, '');

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    // A single trailing group of 1-2 digits after the last comma reads as a
    // decimal separator (European-style); otherwise it's a thousands separator.
    s = parts.length === 2 && parts[1].length <= 2 ? parts.join('.') : s.replace(/,/g, '');
  }

  const num = Number.parseFloat(s);
  if (Number.isNaN(num)) throw new AppError('validation failed: unparseable amount', 400);
  return negative ? -num : num;
}

/**
 * Normalizes a date cell to YYYY-MM-DD. Accepts ISO already, or DD/MM/YYYY
 * (and DD.MM.YYYY) — the common Israeli bank export format.
 * @param {string} raw
 * @returns {string}
 */
function normalizeDate(raw) {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  throw new AppError('validation failed: unparseable date', 400);
}

/** @param {number} userId @param {{amount_agorot,transaction_date,description}} t */
function computeDedupHash(userId, t) {
  const raw = `${userId}:${t.amount_agorot}:${t.transaction_date}:${t.description}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Maps one raw CSV row into a transaction shape using a column mapping. */
function mapRow(headerRow, row, mapping) {
  const indexOf = (colName) => headerRow.indexOf(colName);
  const dateIdx = indexOf(mapping.date);
  const amountIdx = indexOf(mapping.amount);
  const descIdx = indexOf(mapping.description);

  if (dateIdx === -1 || amountIdx === -1) return null;

  return {
    transaction_date: normalizeDate(row[dateIdx]),
    amount_agorot: shekelsToAgorot(parseAmountToShekels(row[amountIdx])),
    description: descIdx === -1 ? null : String(row[descIdx] ?? '').trim() || null,
  };
}

/**
 * Uploads the file, asks Claude for a column mapping, and returns a
 * preview — writes no transactions. docs/API.md § CSV Import.
 *
 * @param {number} userId
 * @param {{ buffer: Buffer, originalname: string, mimetype: string, size: number }} file
 */
async function previewImport(userId, file) {
  storageService.validateCsvFile(file);

  const { headerRow, rows } = parseCsvBuffer(file.buffer);
  const sampleRows = rows.slice(0, SAMPLE_ROW_COUNT_FOR_AI);
  const detectedMapping = await claudeService.detectColumnMapping(headerRow, sampleRows);

  const fileUrl = await storageService.uploadCsvFile(file.buffer, file.originalname);

  const csvImport = await CsvImport.create({
    user_id: userId,
    file_url: fileUrl,
    column_mapping: detectedMapping,
    rows_imported: null,
  });

  const previewRows = rows
    .slice(0, PREVIEW_ROW_COUNT)
    .map((row) => mapRow(headerRow, row, detectedMapping))
    .filter(Boolean);

  return { importId: csvImport.id, detectedMapping, previewRows };
}

/**
 * Re-downloads the stored file, applies the user-confirmed mapping (which
 * may differ from Claude's guess), and inserts new transactions inside one
 * transaction — dedupe via UNIQUE(dedup_hash), docs/DATABASE.md § Idempotency.
 *
 * @param {number} userId
 * @param {number} importId
 * @param {{date: string, amount: string, description: string|null}} mapping
 */
async function confirmImport(userId, importId, mapping) {
  const csvImport = await CsvImport.findOne({ where: { id: importId, user_id: userId } });
  if (!csvImport) {
    throw new AppError('not found: import', 404);
  }
  if (!mapping || !mapping.date || !mapping.amount) {
    throw new AppError('validation failed: mapping', 400);
  }

  let response;
  try {
    response = await fetch(csvImport.file_url, { signal: AbortSignal.timeout(FILE_FETCH_TIMEOUT_MS) });
  } catch {
    // Network/DNS failure or timeout — never leak the raw error.
    // docs/INTEGRATIONS.md § Failure Handling.
    throw new AppError('upstream storage error: could not re-read file', 502);
  }
  if (!response.ok) {
    throw new AppError('upstream storage error: could not re-read file', 502);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const { headerRow, rows } = parseCsvBuffer(buffer);

  const candidates = rows.map((row) => mapRow(headerRow, row, mapping)).filter(Boolean);
  for (const c of candidates) {
    c.dedup_hash = computeDedupHash(userId, c);
  }

  return sequelize.transaction(async (t) => {
    const hashes = candidates.map((c) => c.dedup_hash);
    const existing = await Transaction.findAll({
      where: { dedup_hash: hashes },
      attributes: ['dedup_hash'],
      transaction: t,
    });
    const existingHashes = new Set(existing.map((row) => row.dedup_hash));

    const toInsert = candidates.filter((c) => !existingHashes.has(c.dedup_hash));
    const duplicatesSkipped = candidates.length - toInsert.length;

    if (toInsert.length) {
      await Transaction.bulkCreate(
        toInsert.map((c) => ({
          user_id: userId,
          envelope_id: null,
          amount_agorot: c.amount_agorot,
          description: c.description,
          source: 'csv',
          transaction_date: c.transaction_date,
          dedup_hash: c.dedup_hash,
        })),
        { transaction: t }
      );
    }

    await csvImport.update(
      { column_mapping: mapping, rows_imported: toInsert.length },
      { transaction: t }
    );

    return { imported: toInsert.length, duplicatesSkipped };
  });
}

module.exports = {
  previewImport,
  confirmImport,
  // exported for tests
  parseCsvBuffer,
  parseAmountToShekels,
  normalizeDate,
};
