'use strict';

// Central place defining what each MTAG role is allowed to do.
const PERMISSIONS = {
  Administrator: ['view', 'create', 'edit', 'changeStatus', 'manageUsers', 'viewAudit'],
  'License Officer': ['view', 'create', 'edit'],
  Reviewer: ['view', 'verify'],
  Viewer: ['view'],
};

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/employees/login');
  }
  next();
}

function requireGuest(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/employees/dashboard');
  }
  next();
}

/**
 * Middleware factory: requires the logged-in employee's role to include
 * the given permission. Must run after requireLogin.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.session && req.session.user && req.session.user.role;
    const allowed = PERMISSIONS[role] || [];
    if (!allowed.includes(permission)) {
      return res.status(403).render('error', {
        title: 'غير مصرح',
        message: 'لا تملك الصلاحية للوصول إلى هذه الصفحة.',
        user: req.session.user || null,
      });
    }
    next();
  };
}

module.exports = { requireLogin, requireGuest, requirePermission, PERMISSIONS };
