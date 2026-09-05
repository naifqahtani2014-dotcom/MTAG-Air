'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireLogin, requirePermission, PERMISSIONS } = require('../middleware/auth');
const { getRecentLogs, logAction } = require('../utils/auditLog');

const router = express.Router();

const countByStatusStmt = db.prepare('SELECT status, COUNT(*) AS count FROM licenses GROUP BY status');
const totalLicensesStmt = db.prepare('SELECT COUNT(*) AS count FROM licenses');
const recentLicensesStmt = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC LIMIT 8');

router.get('/dashboard', requireLogin, requirePermission('view'), (req, res) => {
  const counts = { Active: 0, Expired: 0, Suspended: 0, Revoked: 0 };
  for (const row of countByStatusStmt.all()) {
    counts[row.status] = row.count;
  }
  const total = totalLicensesStmt.get().count;
  const recent = recentLicensesStmt.all();

  res.render('dashboard', {
    title: 'لوحة التحكم',
    user: req.session.user,
    counts,
    total,
    recent,
  });
});

router.get('/audit', requireLogin, requirePermission('viewAudit'), (req, res) => {
  const logs = getRecentLogs(300);
  res.render('audit', {
    title: 'سجل التدقيق',
    user: req.session.user,
    logs,
  });
});

// ---------- Employee management (Administrator only) ----------

const listEmployeesStmt = db.prepare(
  'SELECT id, username, full_name, role, active, created_at, last_login_at FROM users ORDER BY created_at DESC'
);
const getUserByUsernameStmt = db.prepare('SELECT id FROM users WHERE username = ?');
const insertUserStmt = db.prepare(
  'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
);
const setActiveStmt = db.prepare('UPDATE users SET active = ? WHERE id = ?');

router.get('/employees-list', requireLogin, requirePermission('manageUsers'), (req, res) => {
  res.render('employees', {
    title: 'إدارة الموظفين',
    user: req.session.user,
    employees: listEmployeesStmt.all(),
    roles: Object.keys(PERMISSIONS),
    errors: [],
  });
});

router.post('/employees-list', requireLogin, requirePermission('manageUsers'), (req, res) => {
  const username = String(req.body.username || '').trim();
  const fullName = String(req.body.full_name || '').trim();
  const role = String(req.body.role || '').trim();
  const password = String(req.body.password || '');

  const errors = [];
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
    errors.push('اسم المستخدم يجب أن يتكون من 3 إلى 50 حرفاً (إنجليزي، أرقام، . _ -).');
  }
  if (!fullName || fullName.length > 150) {
    errors.push('الاسم الكامل مطلوب.');
  }
  if (!Object.keys(PERMISSIONS).includes(role)) {
    errors.push('الدور الوظيفي غير صالح.');
  }
  if (!password || password.length < 8) {
    errors.push('كلمة المرور يجب ألا تقل عن 8 أحرف.');
  }
  if (username && getUserByUsernameStmt.get(username)) {
    errors.push('اسم المستخدم مستخدم بالفعل.');
  }

  if (errors.length) {
    return res.status(400).render('employees', {
      title: 'إدارة الموظفين',
      user: req.session.user,
      employees: listEmployeesStmt.all(),
      roles: Object.keys(PERMISSIONS),
      errors,
    });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  insertUserStmt.run(username, passwordHash, fullName, role);
  logAction(req.session.user.username, 'Employee Account Created', null, `${username} (${role})`);

  res.redirect('/employees/employees-list');
});

router.post('/employees-list/:id/toggle-active', requireLogin, requirePermission('manageUsers'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const desired = req.body.active === '1' ? 1 : 0;

  if (req.session.user.id === id && desired === 0) {
    return res.status(400).render('error', {
      title: 'غير مسموح',
      message: 'لا يمكنك تعطيل حسابك الخاص.',
      user: req.session.user,
    });
  }

  setActiveStmt.run(desired, id);
  logAction(
    req.session.user.username,
    desired ? 'Employee Account Enabled' : 'Employee Account Disabled',
    null,
    `user id ${id}`
  );
  res.redirect('/employees/employees-list');
});

module.exports = router;
