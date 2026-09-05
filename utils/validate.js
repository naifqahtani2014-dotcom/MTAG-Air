'use strict';

const { CATEGORIES, STATUSES } = require('./constants');

const CATEGORY_VALUES = new Set(CATEGORIES.map((c) => c.value));

/**
 * Server-side validation for license create/edit forms.
 * Never trusts the frontend — every field is re-checked here regardless
 * of what client-side validation already did.
 * Returns { valid, errors, data } where data holds the sanitized fields.
 */
function validateLicenseInput(body) {
  const errors = [];

  const holder_name = String(body.holder_name || '').trim();
  const company = String(body.company || '').trim();
  const license_type = String(body.license_type || '').trim();
  const category = String(body.category || '').trim();
  const aircraft_info = String(body.aircraft_info || '').trim();
  const issue_date = String(body.issue_date || '').trim();
  const expiration_date = String(body.expiration_date || '').trim();
  const notes = String(body.notes || '').trim();
  const issued_by = String(body.issued_by || '').trim();

  if (!holder_name || holder_name.length > 200) {
    errors.push('اسم حامل الترخيص مطلوب ويجب ألا يتجاوز 200 حرف.');
  }
  if (!license_type || license_type.length > 200) {
    errors.push('نوع الترخيص مطلوب.');
  }
  if (!CATEGORY_VALUES.has(category)) {
    errors.push('فئة الطيران غير صالحة.');
  }
  if (!issue_date || Number.isNaN(Date.parse(issue_date))) {
    errors.push('تاريخ الإصدار غير صالح.');
  }
  if (!expiration_date || Number.isNaN(Date.parse(expiration_date))) {
    errors.push('تاريخ الانتهاء غير صالح.');
  }
  if (
    issue_date &&
    expiration_date &&
    !Number.isNaN(Date.parse(issue_date)) &&
    !Number.isNaN(Date.parse(expiration_date)) &&
    new Date(expiration_date) < new Date(issue_date)
  ) {
    errors.push('لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ الإصدار.');
  }
  if (!issued_by || issued_by.length > 150) {
    errors.push('اسم الجهة المُصدرة مطلوب.');
  }
  if (company.length > 200) errors.push('اسم الشركة/الجهة طويل جداً.');
  if (aircraft_info.length > 500) errors.push('معلومات الطائرة طويلة جداً.');
  if (notes.length > 2000) errors.push('الملاحظات طويلة جداً.');

  return {
    valid: errors.length === 0,
    errors,
    data: {
      holder_name,
      company,
      license_type,
      category,
      aircraft_info,
      issue_date,
      expiration_date,
      notes,
      issued_by,
    },
  };
}

function isValidStatus(value) {
  return STATUSES.includes(value);
}

module.exports = { validateLicenseInput, isValidStatus };
