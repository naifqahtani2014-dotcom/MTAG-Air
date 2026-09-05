'use strict';

const crypto = require('node:crypto');
const db = require('../db/database');

const PREFIX = '077';
const SUFFIX = 'MTAG';

const existsStmt = db.prepare('SELECT 1 FROM licenses WHERE license_number = ?');

function randomMiddle() {
  // 6-digit numeric section, zero-padded, using a CSPRNG.
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

/**
 * Generates a unique MTAG license number in the format 077.XXXXXX.MTAG.
 * Checks the database before returning to guarantee no duplicates are
 * ever issued, retrying with a fresh random value on the rare collision.
 */
function generateUniqueLicenseNumber() {
  const MAX_ATTEMPTS = 50;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${PREFIX}.${randomMiddle()}.${SUFFIX}`;
    const row = existsStmt.get(candidate);
    if (!row) {
      return candidate;
    }
  }
  throw new Error('تعذر إنشاء رقم ترخيص فريد بعد عدة محاولات. يرجى المحاولة مرة أخرى.');
}

function isValidLicenseNumberFormat(value) {
  return typeof value === 'string' && /^077\.\d{6}\.MTAG$/.test(value.trim());
}

module.exports = { generateUniqueLicenseNumber, isValidLicenseNumberFormat };
