'use strict';

const express = require('express');
const QRCode = require('qrcode');
const db = require('../db/database');
const { requireLogin, requirePermission } = require('../middleware/auth');
const { generateUniqueLicenseNumber, isValidLicenseNumberFormat } = require('../utils/licenseNumber');
const { validateLicenseInput, isValidStatus } = require('../utils/validate');
const { CATEGORIES, LICENSE_TYPE_SUGGESTIONS, categoryLabel, STATUS_LABELS_AR } = require('../utils/constants');
const { logAction } = require('../utils/auditLog');
const { notifyLicenseCreated } = require('../utils/discordNotifier');

const router = express.Router();

const insertLicenseStmt = db.prepare(`
  INSERT INTO licenses
    (license_number, holder_name, company, license_type, category, aircraft_info,
     issue_date, expiration_date, status, notes, issued_by, created_by_user_id)
  VALUES (@license_number, @holder_name, @company, @license_type, @category, @aircraft_info,
     @issue_date, @expiration_date, 'Active', @notes, @issued_by, @created_by_user_id)
`);

const getByNumberStmt = db.prepare('SELECT * FROM licenses WHERE license_number = ?');

const updateLicenseStmt = db.prepare(`
  UPDATE licenses SET
    holder_name = @holder_name,
    company = @company,
    license_type = @license_type,
    category = @category,
    aircraft_info = @aircraft_info,
    issue_date = @issue_date,
    expiration_date = @expiration_date,
    notes = @notes,
    issued_by = @issued_by,
    updated_at = datetime('now')
  WHERE license_number = @license_number
`);

const updateStatusStmt = db.prepare(
  "UPDATE licenses SET status = ?, updated_at = datetime('now') WHERE license_number = ?"
);

function paginatedListQuery({ status, search, page, pageSize }) {
  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }
  if (search) {
    conditions.push(
      '(license_number LIKE @search OR holder_name LIKE @search OR company LIKE @search)'
    );
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT * FROM licenses ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM licenses ${whereClause}`)
    .get(params);

  return { rows, total: totalRow.count };
}

// ---------- Create ----------

router.get('/create', requireLogin, requirePermission('create'), (req, res) => {
  res.render('license-create', {
    title: 'إنشاء ترخيص',
    user: req.session.user,
    categories: CATEGORIES,
    typeSuggestions: LICENSE_TYPE_SUGGESTIONS,
    errors: [],
    formData: {},
  });
});

router.post('/create', requireLogin, requirePermission('create'), async (req, res) => {
  const { valid, errors, data } = validateLicenseInput(req.body);

  if (!valid) {
    return res.status(400).render('license-create', {
      title: 'إنشاء ترخيص',
      user: req.session.user,
      categories: CATEGORIES,
      typeSuggestions: LICENSE_TYPE_SUGGESTIONS,
      errors,
      formData: req.body,
    });
  }

  let licenseNumber;
  try {
    licenseNumber = generateUniqueLicenseNumber();
  } catch (err) {
    console.error('[licenses] failed to generate license number:', err);
    return res.status(500).render('license-create', {
      title: 'إنشاء ترخيص',
      user: req.session.user,
      categories: CATEGORIES,
      typeSuggestions: LICENSE_TYPE_SUGGESTIONS,
      errors: ['تعذر إنشاء رقم ترخيص فريد. حاول مرة أخرى.'],
      formData: req.body,
    });
  }

  let created;
  try {
    insertLicenseStmt.run({
      license_number: licenseNumber,
      holder_name: data.holder_name,
      company: data.company || null,
      license_type: data.license_type,
      category: data.category,
      aircraft_info: data.aircraft_info || null,
      issue_date: data.issue_date,
      expiration_date: data.expiration_date,
      notes: data.notes || null,
      issued_by: data.issued_by,
      created_by_user_id: req.session.user.id,
    });
    created = getByNumberStmt.get(licenseNumber);
  } catch (err) {
    // Extremely unlikely UNIQUE-constraint race; never leaves a duplicate record.
    console.error('[licenses] failed to save license:', err);
    return res.status(500).render('license-create', {
      title: 'إنشاء ترخيص',
      user: req.session.user,
      categories: CATEGORIES,
      typeSuggestions: LICENSE_TYPE_SUGGESTIONS,
      errors: ['حدث خطأ أثناء حفظ الترخيص في قاعدة البيانات. لم يتم إنشاء أي سجل.'],
      formData: req.body,
    });
  }

  logAction(req.session.user.username, 'License Created', licenseNumber, `${data.holder_name} — ${data.license_type}`);

  // Discord notification happens after the DB write and never triggers a retry
  // of the creation itself — the license already exists exactly once.
  const discordResult = await notifyLicenseCreated(created);
  if (!discordResult.ok) {
    logAction(
      req.session.user.username,
      'Discord Notification Failed',
      licenseNumber,
      discordResult.error
    );
  }

  res.redirect(`/licenses/${encodeURIComponent(licenseNumber)}?created=1`);
});

// ---------- List ----------

router.get('/', requireLogin, requirePermission('view'), (req, res) => {
  const status = ['Active', 'Expired', 'Suspended', 'Revoked'].includes(req.query.status)
    ? req.query.status
    : null;
  const search = String(req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 20;

  const { rows, total } = paginatedListQuery({ status, search, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.render('license-list', {
    title: 'إدارة التراخيص',
    user: req.session.user,
    licenses: rows,
    categoryLabel,
    statusLabels: STATUS_LABELS_AR,
    filters: { status, search },
    pagination: { page, totalPages, total },
  });
});

// ---------- Detail ----------

router.get('/:licenseNumber', requireLogin, requirePermission('view'), (req, res) => {
  const licenseNumber = req.params.licenseNumber;
  const license = getByNumberStmt.get(licenseNumber);
  if (!license) {
    return res.status(404).render('error', {
      title: 'غير موجود',
      message: 'لم يتم العثور على هذا الترخيص.',
      user: req.session.user,
    });
  }
  res.render('license-detail', {
    title: `ترخيص ${license.license_number}`,
    user: req.session.user,
    license,
    categoryLabel,
    statusLabels: STATUS_LABELS_AR,
    justCreated: req.query.created === '1',
  });
});

// ---------- Edit ----------

router.get('/:licenseNumber/edit', requireLogin, requirePermission('edit'), (req, res) => {
  const license = getByNumberStmt.get(req.params.licenseNumber);
  if (!license) {
    return res.status(404).render('error', {
      title: 'غير موجود',
      message: 'لم يتم العثور على هذا الترخيص.',
      user: req.session.user,
    });
  }
  res.render('license-edit', {
    title: `تعديل ${license.license_number}`,
    user: req.session.user,
    license,
    categories: CATEGORIES,
    typeSuggestions: LICENSE_TYPE_SUGGESTIONS,
    errors: [],
  });
});

router.post('/:licenseNumber/edit', requireLogin, requirePermission('edit'), (req, res) => {
  const licenseNumber = req.params.licenseNumber;
  const existing = getByNumberStmt.get(licenseNumber);
  if (!existing) {
    return res.status(404).render('error', {
      title: 'غير موجود',
      message: 'لم يتم العثور على هذا الترخيص.',
      user: req.session.user,
    });
  }

  const { valid, errors, data } = validateLicenseInput(req.body);
  if (!valid) {
    return res.status(400).render('license-edit', {
      title: `تعديل ${licenseNumber}`,
      user: req.session.user,
      license: { ...existing, ...req.body },
      categories: CATEGORIES,
      typeSuggestions: LICENSE_TYPE_SUGGESTIONS,
      errors,
    });
  }

  updateLicenseStmt.run({
    license_number: licenseNumber,
    holder_name: data.holder_name,
    company: data.company || null,
    license_type: data.license_type,
    category: data.category,
    aircraft_info: data.aircraft_info || null,
    issue_date: data.issue_date,
    expiration_date: data.expiration_date,
    notes: data.notes || null,
    issued_by: data.issued_by,
  });

  logAction(req.session.user.username, 'License Edited', licenseNumber);

  res.redirect(`/licenses/${encodeURIComponent(licenseNumber)}`);
});

// ---------- Status change (Administrator only) ----------

router.post('/:licenseNumber/status', requireLogin, requirePermission('changeStatus'), (req, res) => {
  const licenseNumber = req.params.licenseNumber;
  const newStatus = String(req.body.status || '').trim();
  const existing = getByNumberStmt.get(licenseNumber);

  if (!existing) {
    return res.status(404).render('error', {
      title: 'غير موجود',
      message: 'لم يتم العثور على هذا الترخيص.',
      user: req.session.user,
    });
  }
  if (!isValidStatus(newStatus)) {
    return res.status(400).render('error', {
      title: 'خطأ',
      message: 'حالة الترخيص غير صالحة.',
      user: req.session.user,
    });
  }

  updateStatusStmt.run(newStatus, licenseNumber);

  const actionMap = {
    Active: 'License Restored',
    Suspended: 'License Suspended',
    Revoked: 'License Revoked',
    Expired: 'License Marked Expired',
  };
  logAction(req.session.user.username, actionMap[newStatus] || 'License Status Changed', licenseNumber);

  res.redirect(`/licenses/${encodeURIComponent(licenseNumber)}`);
});

// ---------- Certificate ----------

router.get('/:licenseNumber/certificate', requireLogin, requirePermission('view'), async (req, res) => {
  const license = getByNumberStmt.get(req.params.licenseNumber);
  if (!license) {
    return res.status(404).render('error', {
      title: 'غير موجود',
      message: 'لم يتم العثور على هذا الترخيص.',
      user: req.session.user,
    });
  }

  const verifyUrl = `${req.protocol}://${req.get('host')}/verify?number=${encodeURIComponent(license.license_number)}`;
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220, color: { dark: '#0b3d91', light: '#ffffff' } });
  } catch (err) {
    console.error('[certificate] QR generation failed:', err);
  }

  res.render('certificate', {
    title: `شهادة ${license.license_number}`,
    user: req.session.user,
    license,
    categoryLabel,
    statusLabels: STATUS_LABELS_AR,
    qrDataUrl,
    verifyUrl,
  });
});

module.exports = router;
