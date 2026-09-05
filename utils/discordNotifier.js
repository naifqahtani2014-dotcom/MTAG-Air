'use strict';

/**
 * Sends MTAG license notifications to a Discord channel via webhook.
 * The webhook URL is read only from the server-side environment variable
 * DISCORD_LICENSE_WEBHOOK_URL — it is never sent to, or embedded in, the
 * browser/frontend.
 */

const WEBHOOK_URL = process.env.DISCORD_LICENSE_WEBHOOK_URL || '';

const STATUS_LABELS = {
  Active: '✅ Active',
  Expired: '⌛ Expired',
  Suspended: '⛔ Suspended',
  Revoked: '🚫 Revoked',
};

/**
 * Sends a "new license issued" embed to the configured Discord webhook.
 * Never throws — logs failures server-side and returns a { ok, error } result
 * so callers can decide whether to inform the user, without ever retrying
 * the license creation itself (the DB write already happened and must not
 * be duplicated).
 */
async function notifyLicenseCreated(license) {
  if (!WEBHOOK_URL) {
    console.warn('[discord] DISCORD_LICENSE_WEBHOOK_URL is not set — skipping notification.');
    return { ok: false, error: 'webhook_not_configured' };
  }

  const embed = {
    title: '🛫 MTAG | ترخيص جديد',
    color: 0x0b3d91,
    fields: [
      { name: 'License Number', value: `\`${license.license_number}\``, inline: false },
      { name: 'License Holder', value: license.holder_name || '—', inline: true },
      { name: 'Company', value: license.company || '—', inline: true },
      { name: 'License Type', value: license.license_type || '—', inline: true },
      { name: 'Category', value: license.category || '—', inline: true },
      { name: 'Issue Date', value: license.issue_date || '—', inline: true },
      { name: 'Expiration Date', value: license.expiration_date || '—', inline: true },
      { name: 'Status', value: STATUS_LABELS[license.status] || license.status, inline: true },
      { name: 'Issued By', value: license.issued_by || '—', inline: true },
    ],
    footer: { text: 'MTAG | منظومة الطيران العالمي — منظمة خيالية تابعة لروبلكس' },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: 'MTAG License Bot',
    embeds: [embed],
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[discord] webhook responded with ${response.status}: ${text}`);
      return { ok: false, error: `http_${response.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error('[discord] failed to send webhook notification:', err);
    return { ok: false, error: 'network_error' };
  }
}

module.exports = { notifyLicenseCreated };
