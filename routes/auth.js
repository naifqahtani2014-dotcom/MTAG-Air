'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireGuest, requireLogin } = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

const router = express.Router();

const getUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const touchLoginStmt = db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?");

router.get('/login', requireGuest, (req, res) => {
  res.render('login', { title: 'دخول الموظفين', error: null, user: null });
});

router.post('/login', requireGuest, (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).render('login', {
      title: 'دخول الموظفين',
      error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
      user: null,
    });
  }

  const account = getUserByUsername.get(username);

  const genericError = 'اسم المستخدم أو كلمة المرور غير صحيحة.';

  if (!account || !account.active) {
    logAction(username, 'Failed Login Attempt');
    return res.status(401).render('login', { title: 'دخول الموظفين', error: genericError, user: null });
  }

  const passwordMatches = bcrypt.compareSync(password, account.password_hash);
  if (!passwordMatches) {
    logAction(username, 'Failed Login Attempt');
    return res.status(401).render('login', { title: 'دخول الموظفين', error: genericError, user: null });
  }

  req.session.regenerate((err) => {
    if (err) {
      console.error('[auth] session regenerate error:', err);
      return res.status(500).render('login', {
        title: 'دخول الموظفين',
        error: 'حدث خطأ في الخادم. حاول مرة أخرى.',
        user: null,
      });
    }

    req.session.user = {
      id: account.id,
      username: account.username,
      fullName: account.full_name,
      role: account.role,
    };

    touchLoginStmt.run(account.id);
    logAction(account.username, 'Employee Login');

    res.redirect('/employees/dashboard');
  });
});

router.post('/logout', requireLogin, (req, res) => {
  const username = req.session.user ? req.session.user.username : 'unknown';
  req.session.destroy(() => {
    logAction(username, 'Employee Logout');
    res.redirect('/employees/login');
  });
});

module.exports = router;
