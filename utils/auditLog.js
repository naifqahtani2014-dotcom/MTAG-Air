'use strict';

const db = require('../db/database');

const insertStmt = db.prepare(
  'INSERT INTO audit_logs (username, action, license_number, details) VALUES (?, ?, ?, ?)'
);

/**
 * Records an entry in the local audit log.
 * @param {string} username
 * @param {string} action - short action label, e.g. "License Created"
 * @param {string|null} licenseNumber
 * @param {string|null} details - optional free-text details
 */
function logAction(username, action, licenseNumber = null, details = null) {
  try {
    insertStmt.run(username, action, licenseNumber, details);
  } catch (err) {
    // Auditing must never crash the request that triggered it.
    console.error('[audit] failed to write audit log entry:', err);
  }
}

function getRecentLogs(limit = 100) {
  return db
    .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?')
    .all(limit);
}

module.exports = { logAction, getRecentLogs };
