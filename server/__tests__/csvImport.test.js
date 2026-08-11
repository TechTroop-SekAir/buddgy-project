'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.CLOUDINARY_URL = process.env.CLOUDINARY_URL || 'cloudinary://key:secret@cloud';

const iconv = require('iconv-lite');

// Mock every external boundary — Claude, storage/Cloudinary, and the DB —
// docs/INTEGRATIONS.md § Failure Handling / C-09 requires mocked externals in CI.
const mockDetectColumnMapping = jest.fn();
jest.mock('../services/claudeService', () => ({
  detectColumnMapping: (...args) => mockDetectColumnMapping(...args),
}));

const mockUploadCsvFile = jest.fn();
jest.mock('../services/storageService', () => {
  const actual = jest.requireActual('../services/storageService');
  return {
    ...actual,
    uploadCsvFile: (...args) => mockUploadCsvFile(...args),
  };
});

const mockCsvImportCreate = jest.fn();
const mockCsvImportFindOne = jest.fn();
const mockTransactionFindAll = jest.fn();
const mockTransactionBulkCreate = jest.fn();
jest.mock('../models', () => ({
  CsvImport: {
    create: (...args) => mockCsvImportCreate(...args),
    findOne: (...args) => mockCsvImportFindOne(...args),
  },
  Transaction: {
    findAll: (...args) => mockTransactionFindAll(...args),
    bulkCreate: (...args) => mockTransactionBulkCreate(...args),
  },
  sequelize: {
    transaction: async (fn) => fn({}),
  },
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

const AUTHED_USER_ID = 1;

function authHeader(userId = AUTHED_USER_ID) {
  const token = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

const CLEAN_CSV = ['Transaction Date,Charge Amount,Merchant', '2026-08-01,129.90,Shufersal Deal', '2026-08-02,54.00,Cafe Nordoy'].join('\n');

beforeEach(() => {
  jest.clearAllMocks();
  mockDetectColumnMapping.mockResolvedValue({
    date: 'Transaction Date',
    amount: 'Charge Amount',
    description: 'Merchant',
  });
  mockUploadCsvFile.mockResolvedValue('https://res.cloudinary.com/demo/raw/upload/csv_imports/statement.csv');
  mockCsvImportCreate.mockResolvedValue({ id: 12 });
  global.fetch = jest.fn();
});

describe('POST /api/imports/preview', () => {
  it('parses the file, asks Claude for a mapping, and returns a preview without writing transactions', async () => {
    const res = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from(CLEAN_CSV, 'utf8'), 'statement.csv');

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.importId).toBe(12);
    expect(res.body.data.detectedMapping).toEqual({
      date: 'Transaction Date',
      amount: 'Charge Amount',
      description: 'Merchant',
    });
    expect(res.body.data.previewRows).toHaveLength(2);
    expect(res.body.data.previewRows[0]).toEqual({
      transaction_date: '2026-08-01',
      amount_agorot: 12990,
      description: 'Shufersal Deal',
    });
    expect(Number.isInteger(res.body.data.previewRows[0].amount_agorot)).toBe(true);
    expect(mockTransactionBulkCreate).not.toHaveBeenCalled();
  });

  it('parses a UTF-8 BOM + windows-1255 Hebrew file without dropping rows', async () => {
    const hebrewCsv = ['Transaction Date,Charge Amount,Merchant', '2026-08-01,50.00,שופרסל'].join('\n');
    const bomPrefixed = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), iconv.encode(hebrewCsv, 'windows-1255')]);

    const res = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', authHeader())
      .attach('file', bomPrefixed, 'statement.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.previewRows).toHaveLength(1);
    expect(res.body.data.previewRows[0].description).toBe('שופרסל');
  });

  it('parses a semicolon-delimited file', async () => {
    const semicolonCsv = ['Transaction Date;Charge Amount;Merchant', '2026-08-01;75.50;Cafe Nordoy'].join('\n');

    const res = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from(semicolonCsv, 'utf8'), 'statement.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.previewRows).toHaveLength(1);
    expect(res.body.data.previewRows[0].amount_agorot).toBe(7550);
  });

  it('rejects an oversized upload with 400 before touching storage', async () => {
    const bigCsv = 'Transaction Date,Charge Amount,Merchant\n' + '2026-08-01,10.00,X\n'.repeat(600000);

    const res = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from(bigCsv, 'utf8'), 'statement.csv');

    expect(res.status).toBe(400);
    expect(mockUploadCsvFile).not.toHaveBeenCalled();
  });

  it('rejects a non-CSV file with 400 before touching storage', async () => {
    const res = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('not a csv'), { filename: 'statement.exe', contentType: 'application/octet-stream' });

    expect(res.status).toBe(400);
    expect(mockUploadCsvFile).not.toHaveBeenCalled();
  });

  it('returns 422 when Claude fails, with no stack trace leaked', async () => {
    mockDetectColumnMapping.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 422, isAppError: true }));

    const res = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from(CLEAN_CSV, 'utf8'), 'statement.csv');

    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/imports/preview')
      .attach('file', Buffer.from(CLEAN_CSV, 'utf8'), 'statement.csv');

    expect(res.status).toBe(401);
    expect(mockUploadCsvFile).not.toHaveBeenCalled();
  });
});

describe('POST /api/imports/:id/confirm', () => {
  const mapping = { date: 'Transaction Date', amount: 'Charge Amount', description: 'Merchant' };

  beforeEach(() => {
    mockCsvImportFindOne.mockResolvedValue({
      id: 12,
      file_url: 'https://res.cloudinary.com/demo/raw/upload/csv_imports/statement.csv',
      update: jest.fn().mockResolvedValue(undefined),
    });
    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from(CLEAN_CSV, 'utf8') });
  });

  it('inserts new transactions and reports zero duplicates on a clean import', async () => {
    mockTransactionFindAll.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/imports/12/confirm')
      .set('Authorization', authHeader())
      .send({ mapping });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imported: 2, duplicatesSkipped: 0 });
    expect(mockTransactionBulkCreate).toHaveBeenCalledTimes(1);
    const inserted = mockTransactionBulkCreate.mock.calls[0][0];
    expect(inserted).toHaveLength(2);
    expect(inserted[0].source).toBe('csv');
    expect(Number.isInteger(inserted[0].amount_agorot)).toBe(true);
  });

  it('skips rows whose dedup_hash already exists and reports the skip count', async () => {
    // Simulate: on re-upload, both rows already exist.
    mockTransactionFindAll.mockImplementation(async ({ where }) => where.dedup_hash.map((dedup_hash) => ({ dedup_hash })));

    const res = await request(app)
      .post('/api/imports/12/confirm')
      .set('Authorization', authHeader())
      .send({ mapping });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imported: 0, duplicatesSkipped: 2 });
    expect(mockTransactionBulkCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the mapping is missing required columns', async () => {
    const res = await request(app)
      .post('/api/imports/12/confirm')
      .set('Authorization', authHeader())
      .send({ mapping: { description: 'Merchant' } });

    expect(res.status).toBe(400);
    expect(mockTransactionBulkCreate).not.toHaveBeenCalled();
  });

  it('returns 404 for an import belonging to another user', async () => {
    mockCsvImportFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/imports/12/confirm')
      .set('Authorization', authHeader())
      .send({ mapping });

    expect(res.status).toBe(404);
  });

  it('returns 502, not a hang, when re-fetching the stored file times out', async () => {
    global.fetch.mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

    const res = await request(app)
      .post('/api/imports/12/confirm')
      .set('Authorization', authHeader())
      .send({ mapping });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('upstream storage error: could not re-read file');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack trace leaked
    expect(mockTransactionBulkCreate).not.toHaveBeenCalled();
  });

  it('rejects with 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/imports/12/confirm').send({ mapping });

    expect(res.status).toBe(401);
    expect(mockCsvImportFindOne).not.toHaveBeenCalled();
  });
});
