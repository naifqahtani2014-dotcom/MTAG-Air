'use strict';

const CATEGORIES = [
  { value: 'Civil Aviation', label: 'الطيران المدني' },
  { value: 'Military Aviation', label: 'الطيران العسكري' },
  { value: 'Air Transport', label: 'النقل الجوي' },
  { value: 'Aviation Academy', label: 'أكاديمية الطيران' },
  { value: 'Airline', label: 'شركة طيران' },
  { value: 'Pilot', label: 'طيار' },
  { value: 'Aircraft', label: 'طائرة' },
  { value: 'Other', label: 'أخرى' },
];

const LICENSE_TYPE_SUGGESTIONS = [
  'رخصة طيار خاص',
  'رخصة طيار تجاري',
  'رخصة تشغيل شركة طيران',
  'رخصة صلاحية طيران',
  'رخصة أكاديمية تدريب',
  'رخصة تسجيل طائرة',
  'رخصة نقل جوي',
];

const STATUSES = ['Active', 'Expired', 'Suspended', 'Revoked'];

const STATUS_LABELS_AR = {
  Active: 'سارٍ',
  Expired: 'منتهي',
  Suspended: 'موقوف',
  Revoked: 'ملغى',
};

function categoryLabel(value) {
  const found = CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value;
}

module.exports = {
  CATEGORIES,
  LICENSE_TYPE_SUGGESTIONS,
  STATUSES,
  STATUS_LABELS_AR,
  categoryLabel,
};
