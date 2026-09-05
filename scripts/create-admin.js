'use strict';

/**
 * Interactive CLI to create the first MTAG Administrator account
 * (or any additional employee account) directly from the terminal.
 *
 * Usage:
 *   node scripts/create-admin.js
 */

require('dotenv').config();
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const ROLES = ['Administrator', 'License Officer', 'Reviewer', 'Viewer'];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

// Basic password prompt without extra dependencies.
// When running in a real terminal (TTY), input is masked character-by-character.
// When input is piped (e.g. during automated testing), falls back to a plain
// line read since there is no terminal to mask output on anyway.
function askPassword(question) {
  const stdin = process.stdin;

  if (!stdin.isTTY) {
    return ask(question);
  }

  return new Promise((resolve) => {
    process.stdout.write(question);
    let input = '';
    const onData = (chunk) => {
      const str = chunk.toString('utf8');
      for (const char of str) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
          return;
        }
        if (char === '\u0003') {
          process.exit(1);
        }
        if (char === '\u007f') {
          input = input.slice(0, -1);
          continue;
        }
        input += char;
      }
    };
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('\n=== MTAG | منظومة الطيران العالمي — إنشاء حساب موظف ===\n');

  const username = await ask('اسم المستخدم (username, أحرف إنجليزية): ');
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
    console.error('❌ اسم مستخدم غير صالح. استخدم 3-50 حرفاً إنجليزياً/أرقام/._-');
    process.exit(1);
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    console.error('❌ اسم المستخدم هذا موجود بالفعل.');
    process.exit(1);
  }

  const fullName = await ask('الاسم الكامل: ');
  if (!fullName) {
    console.error('❌ الاسم الكامل مطلوب.');
    process.exit(1);
  }

  console.log(`الأدوار المتاحة: ${ROLES.join(' / ')}`);
  const role = (await ask('الدور الوظيفي [Administrator]: ')) || 'Administrator';
  if (!ROLES.includes(role)) {
    console.error('❌ دور غير صالح.');
    process.exit(1);
  }

  const password = await askPassword('كلمة المرور (8 أحرف على الأقل): ');
  if (!password || password.length < 8) {
    console.error('❌ كلمة المرور قصيرة جداً.');
    process.exit(1);
  }
  const confirm = await askPassword('تأكيد كلمة المرور: ');
  if (password !== confirm) {
    console.error('❌ كلمتا المرور غير متطابقتين.');
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
    username,
    passwordHash,
    fullName,
    role
  );

  console.log(`\n✅ تم إنشاء الحساب بنجاح: ${username} (${role})`);
  console.log('يمكنك الآن تسجيل الدخول عبر: http://localhost:3000/employees/login\n');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('حدث خطأ:', err);
  process.exit(1);
});
