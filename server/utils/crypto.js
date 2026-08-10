'use strict';

const crypto = require('crypto');
const AppError = require('./AppError');

// Application-level encryption for secrets stored at rest (currently only
// users.google_refresh_token) — see docs/SECURITY.md § Data Protection.
// AES-256-GCM with a fresh random IV per call. Ciphertext is packed as a
// single string so it fits the existing TEXT column with no migration.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recommended IV length for GCM
const KEY_LENGTH_BYTES = 32; // AES-256

function loadKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. See .env.example / CLAUDE.md § Environment Variables.'
    );
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH_BYTES} bytes hex-encoded (${KEY_LENGTH_BYTES * 2} hex chars).`
    );
  }
  return key;
}

// Read once at module load — fail fast rather than falling back silently,
// which would produce tokens that can never be decrypted later.
const KEY = loadKey();

/** @param {string} plaintext @returns {string} `iv:authTag:ciphertext`, all base64 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':'
  );
}

/** @param {string} packed `iv:authTag:ciphertext` as produced by encrypt() @returns {string} */
function decrypt(packed) {
  const parts = typeof packed === 'string' ? packed.split(':') : [];
  if (parts.length !== 3) {
    throw new AppError('Stored credential is malformed and could not be decrypted.', 500);
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    // Wrong key, tampered ciphertext, or bad auth tag — never leak details.
    throw new AppError('Stored credential could not be decrypted.', 500);
  }
}

module.exports = { encrypt, decrypt };
