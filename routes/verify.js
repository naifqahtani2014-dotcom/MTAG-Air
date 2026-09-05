'use strict';

const express = require('express');
const db = require('../db/database');
const { isValidLicenseNumberFormat } = require('../utils/licenseNumber');
const { categoryLabel, STATUS_LABELS_AR } = require('../utils/constants');
const { logAction } = require('../utils/auditLog');

const router = express.Router();

const getByNumberStmt = db.prepare('SELECT * FROM licenses WHERE license_number = ?');

router.get('/', (req, res) => {
  const rawNumber = String(req.query.number || '').trim();

  if (!rawNumber) {
    return res.render('verify', {
      title: 'التحقق من ترخيص',
      user: req.session ? req.session.user : null,
      searched: false,
      queryNumber: '',
      formatError: false,
      license: null,
      categoryLabel,
      statusLabels: STATUS_LABELS_AR,
    });
  }

  if (!isValidLicenseNumberFormat(rawNumber)) {
    return res.render('verify', {
      title: 'التحقق من ترخيص',
      user: req.session ? req.session.user : null,
      searched: true,
      queryNumber: rawNumber,
      formatError: true,
      license: null,
      categoryLabel,
      statusLabels: STATUS_LABELS_AR,
    });
  }

  const license = getByNumberStmt.get(rawNumber.trim());

  // Only public-safe fields are ever exposed here — no internal IDs, no
  // employee/user data, no audit information.
  logAction('public', 'License Verification Lookup', rawNumber, license ? 'found' : 'not_found');

  res.render('verify', {
    title: 'التحقق من ترخيص',
    user: req.session ? req.session.user : null,
    searched: true,
    queryNumber: rawNumber,
    formatError: false,
    license,
    categoryLabel,
    statusLabels: STATUS_LABELS_AR,
  });
});

module.exports = router;
