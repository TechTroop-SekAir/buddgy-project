'use strict';

const cloudinary = require('cloudinary').v2;
const AppError = require('../utils/AppError');

// Single interface regardless of provider (Cloudinary now, swappable later) —
// mirrors the client/src/components/ui/ adapter pattern. docs/INTEGRATIONS.md
// § Cloudinary / AWS S3. The DB only ever stores the resulting URL — binary
// content never touches PostgreSQL (CLAUDE.md § External Integrations).
//
// C-07's CSV half, pulled forward for C-04 — see docs/PLAN.md. The avatar
// upload path is added when the rest of C-07 (profile pictures) lands.

const ALLOWED_CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/csv',
  'text/plain',
]);
const MAX_CSV_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
// A stalled upload must fail fast, not hang the request indefinitely —
// docs/INTEGRATIONS.md § Failure Handling.
const STORAGE_UPLOAD_TIMEOUT_MS = 30000;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const url = process.env.CLOUDINARY_URL;
  if (!url) {
    throw new Error('CLOUDINARY_URL is not set. See .env.example / CLAUDE.md § Environment Variables.');
  }
  // cloudinary.config() reads CLOUDINARY_URL from the env automatically,
  // but calling it explicitly fails fast if it's missing rather than
  // discovering it on the first upload.
  cloudinary.config({ cloudinary_url: url });
  configured = true;
}

/**
 * Validates a CSV upload at the API boundary, before any bytes leave the
 * request — docs/INTEGRATIONS.md § Cloudinary / AWS S3: "reject a 50 MB
 * 'CSV' at the API boundary", not after the round-trip.
 *
 * @param {{ mimetype: string, size: number, originalname: string }} file - multer's file object
 */
function validateCsvFile(file) {
  if (!file) {
    throw new AppError('validation failed: file', 400);
  }
  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    throw new AppError('validation failed: file too large (max 10MB)', 400);
  }
  const looksLikeCsv = /\.csv$/i.test(file.originalname);
  if (!ALLOWED_CSV_MIME_TYPES.has(file.mimetype) && !looksLikeCsv) {
    throw new AppError('validation failed: file must be a CSV', 400);
  }
}

/**
 * Uploads a CSV file's raw bytes to storage and returns its URL. Never
 * persists the buffer itself — csv_imports.file_url is the only thing
 * that reaches the DB.
 *
 * @param {Buffer} buffer
 * @param {string} originalname
 * @returns {Promise<string>} the stored file's URL
 */
async function uploadCsvFile(buffer, originalname) {
  ensureConfigured();

  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        uploadStream.destroy(new Error('upload timed out'));
        reject(new Error('upload timed out'));
      }, STORAGE_UPLOAD_TIMEOUT_MS);
      timer.unref?.();

      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'csv_imports', filename_override: originalname, use_filename: true },
        (err, res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          err ? reject(err) : resolve(res);
        }
      );
      uploadStream.end(buffer);
    });
    return result.secure_url;
  } catch {
    // Never leak the raw provider error — docs/INTEGRATIONS.md § Failure Handling.
    throw new AppError('upstream storage error: upload failed', 502);
  }
}

module.exports = { validateCsvFile, uploadCsvFile, MAX_CSV_FILE_SIZE_BYTES };
