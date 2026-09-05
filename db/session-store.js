'use strict';

/**
 * A minimal express-session store backed by our node:sqlite database.
 * Avoids pulling in an extra native dependency just for sessions.
 */

const session = require('express-session');
const db = require('./database');

class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    this._getStmt = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
    this._setStmt = db.prepare(
      'INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?) ' +
      'ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data'
    );
    this._destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this._cleanupStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');

    // Periodically clear expired sessions.
    this._cleanupTimer = setInterval(() => {
      try {
        this._cleanupStmt.run(Date.now());
      } catch (err) {
        // ignore cleanup errors
      }
    }, 15 * 60 * 1000);
    this._cleanupTimer.unref();
  }

  get(sid, callback) {
    try {
      const row = this._getStmt.get(sid);
      if (!row) return callback(null, null);
      if (row.expires < Date.now()) {
        this._destroyStmt.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge
        ? sessionData.cookie.maxAge
        : 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      this._setStmt.run(sid, expires, JSON.stringify(sessionData));
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this._destroyStmt.run(sid);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge
        ? sessionData.cookie.maxAge
        : 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      this._touchStmt.run(expires, sid);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }
}

module.exports = SQLiteSessionStore;
