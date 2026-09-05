'use strict';

/**
 * MTAG | منظومة الطيران العالمي
 * Database layer built on Node's built-in `node:sqlite` module.
 * No native compilation required — works out of the box on Node.js v22.5+/v24.
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mtag.db');

const db = new DatabaseSync(DB_PATH);

// Sensible pragmas for a small local single-writer app.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Administrator','License Officer','Reviewer','Viewer')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_number TEXT NOT NULL UNIQUE,
  holder_name TEXT NOT NULL,
  company TEXT,
  license_type TEXT NOT NULL,
  category TEXT NOT NULL,
  aircraft_info TEXT,
  issue_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active','Expired','Suspended','Revoked')) DEFAULT 'Active',
  notes TEXT,
  issued_by TEXT NOT NULL,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  license_number TEXT,
  details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data TEXT NOT NULL
);
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);');
db.exec('CREATE INDEX IF NOT EXISTS idx_licenses_holder ON licenses(holder_name);');
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);');

module.exports = db;
