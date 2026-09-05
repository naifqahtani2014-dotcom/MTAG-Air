'use strict';

require('dotenv').config();

const path = require('node:path');
const express = require('express');
const session = require('express-session');

const SQLiteSessionStore = require('./db/session-store');

const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/licenses');
const verifyRoutes = require('./routes/verify');
const adminRoutes = require('./routes/admin');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error(
    '\n[إعداد ناقص] يرجى ضبط متغير البيئة SESSION_SECRET في ملف .env قبل التشغيل.\n' +
    'مثال: SESSION_SECRET=change_this_to_a_long_random_string\n'
  );
  process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new SQLiteSessionStore(),
    name: 'mtag.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Local-only app served over http://localhost — do not force `secure`,
      // or the session cookie will silently never be set.
      secure: false,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

// Basic security headers (no extra dependency needed for a local app).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.locals.DISCLAIMER = 'منظمة خيالية تابعة لروبلكس لا تمثل الواقع ولا تمت له بصلة.';
app.locals.SITE_TITLE = 'MTAG | منظومة الطيران العالمي';

app.get('/', (req, res) => {
  res.render('index', {
    title: 'الرئيسية',
    user: req.session.user || null,
  });
});

app.use('/employees', authRoutes);
app.use('/employees', adminRoutes);
app.use('/licenses', licenseRoutes);
app.use('/verify', verifyRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'الصفحة غير موجودة', user: req.session.user || null });
});

// Centralized error handler — never leaks internals to the client.
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).render('error', {
    title: 'خطأ في الخادم',
    message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.',
    user: (req.session && req.session.user) || null,
  });
});

app.listen(PORT, () => {
  console.log(`\n✈️  MTAG يعمل الآن على: http://localhost:${PORT}\n`);
});
