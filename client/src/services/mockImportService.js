// Fake backend for ticket A-11. Real C-04 endpoints (server/routes/imports.js) exist and work,
// but this keeps VITE_USE_MOCK_API=true fully functional without a running
// server/Cloudinary/Claude key. Reuses buddgy_mock_transactions so imported
// rows show up on the Transactions page next to seeded/quick-entry ones.
const IMPORTS_KEY = 'buddgy_mock_imports';
const TRANSACTIONS_KEY = 'buddgy_mock_transactions';
const PREVIEW_ROW_COUNT = 10;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadTransactions() {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function loadImports() {
  try {
    const raw = localStorage.getItem(IMPORTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveImports(imports) {
  localStorage.setItem(IMPORTS_KEY, JSON.stringify(imports));
}

function sniffDelimiter(headerLine) {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsvText(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new Error('validation failed: file has no rows');

  const delimiter = sniffDelimiter(lines[0]);
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  const [header, ...dataRows] = rows;
  if (dataRows.length === 0) throw new Error('validation failed: file has no rows');

  return { header, dataRows };
}

const DATE_KEYWORDS = ['date', 'תאריך'];
const AMOUNT_KEYWORDS = ['amount', 'charge', 'סכום'];
const DESCRIPTION_KEYWORDS = ['description', 'merchant', 'תיאור', 'עסק'];

function guessColumn(header, keywords) {
  const match = header.find((name) => keywords.some((keyword) => name.toLowerCase().includes(keyword)));
  return match ?? null;
}

function normalizeDate(raw) {
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const slashMatch = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, yearRaw] = slashMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  throw new Error('validation failed: unparseable date');
}

function normalizeAmount(raw) {
  const cleaned = raw.replace(/[₪$,\s]/g, '');
  const value = Number(cleaned);
  if (Number.isNaN(value)) throw new Error('validation failed: unparseable amount');
  return Math.round(value * 100);
}

function mapRow(row, header, mapping) {
  const indexOf = (columnName) => (columnName ? header.indexOf(columnName) : -1);
  const dateIndex = indexOf(mapping.date);
  const amountIndex = indexOf(mapping.amount);
  const descriptionIndex = indexOf(mapping.description);

  return {
    transaction_date: dateIndex >= 0 ? normalizeDate(row[dateIndex]) : null,
    amount_agorot: amountIndex >= 0 ? normalizeAmount(row[amountIndex]) : null,
    description: descriptionIndex >= 0 ? row[descriptionIndex] : null,
  };
}

// Deterministic failure trigger: a filename containing "fail" fakes Claude mapping detection
// throwing, so the 422-equivalent path is demoable without a server.
export async function preview(file, userId) {
  await delay(600);

  if (/fail/i.test(file.name)) {
    throw new Error('unprocessable: ai parse failed');
  }

  const text = await file.text();
  const { header, dataRows } = parseCsvText(text);

  const detectedMapping = {
    date: guessColumn(header, DATE_KEYWORDS),
    amount: guessColumn(header, AMOUNT_KEYWORDS),
    description: guessColumn(header, DESCRIPTION_KEYWORDS),
  };

  const importId = crypto.randomUUID();
  const imports = loadImports();
  imports[importId] = { userId, header, dataRows, detectedMapping };
  saveImports(imports);

  const previewRows = dataRows.slice(0, PREVIEW_ROW_COUNT).map((row) => {
    try {
      return mapRow(row, header, detectedMapping);
    } catch {
      return { transaction_date: null, amount_agorot: null, description: null };
    }
  });

  return { importId, detectedMapping, previewRows };
}

export async function confirm(importId, mapping, userId) {
  await delay(400);

  const imports = loadImports();
  const record = imports[importId];
  if (!record) throw new Error('not found: import');

  if (!mapping?.date || !mapping?.amount) {
    throw new Error('validation failed: mapping');
  }

  const transactions = loadTransactions();
  const existingHashes = new Set(
    transactions.filter((t) => t.user_id === userId).map((t) => t.dedup_hash)
  );

  let imported = 0;
  let duplicatesSkipped = 0;

  record.dataRows.forEach((row) => {
    const mapped = mapRow(row, record.header, mapping);
    const dedupHash = `${mapped.amount_agorot}:${mapped.transaction_date}:${mapped.description}`;

    if (existingHashes.has(dedupHash)) {
      duplicatesSkipped += 1;
      return;
    }

    existingHashes.add(dedupHash);
    transactions.push({
      id: crypto.randomUUID(),
      user_id: userId,
      envelope_id: null,
      amount_agorot: mapped.amount_agorot,
      description: mapped.description,
      source: 'csv',
      transaction_date: mapped.transaction_date,
      dedup_hash: dedupHash,
    });
    imported += 1;
  });

  saveTransactions(transactions);

  return { imported, duplicatesSkipped };
}
