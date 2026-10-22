// Notifications (Phase 8): tell people when something needs them — a new
// chat message, a visit request or answer, a payment decision.
//
// Channels:
// - In-app inbox (always): the bell on Home → /[locale]/notifications.
//   Chat messages are left out of the inbox (the Messages tab already
//   counts them) and only go out on the external channels below.
// - SMS via Twilio (TWILIO_ACCOUNT_SID + either TWILIO_AUTH_TOKEN or an
//   API key pair TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET, TWILIO_SMS_FROM)
//   to the phone on the account, in +509 form.
// - WhatsApp via Twilio (TWILIO_WHATSAPP_FROM). Note: outside a 24 h
//   conversation window WhatsApp only delivers pre-approved templates, so
//   free-text messages may be refused until a template is approved.
// - Email via Resend (RESEND_API_KEY, EMAIL_FROM) to the account email.
// Nothing external is sent unless its keys are set — no cost by default.
//
// Sending never blocks or breaks the request that triggered it: it runs
// after the response path, with a timeout, and failures are only logged.
// External chat alerts are throttled to one per conversation per person
// per 15 minutes. Messages go out in the account's language.
import { query } from './db';
import { getDict } from './dictionaries';
import { log } from './log';

const PUBLIC_BASE_URL = () => (process.env.PUBLIC_BASE_URL || 'https://kayayiti.app').replace(/\/$/, '');
const CHAT_THROTTLE_MS = 15 * 60 * 1000;
// Provider base URLs; overridable only so tests can point at a fake.
const TWILIO_BASE = () => process.env.NOTIFY_TWILIO_BASE || 'https://api.twilio.com';
const RESEND_BASE = () => process.env.NOTIFY_RESEND_BASE || 'https://api.resend.com';
const lastChatAlert = new Map(); // `${username}|${threadKey}` -> ms

// Twilio accepts either the Account SID + Auth Token, or an API key
// (SK… + secret) — recommended, since it can be revoked on its own.
// The Account SID is always needed: it is part of the request URL.
function twilioAuth() {
  const e = process.env;
  if (!e.TWILIO_ACCOUNT_SID) return null;
  if (e.TWILIO_API_KEY_SID && e.TWILIO_API_KEY_SECRET) return `${e.TWILIO_API_KEY_SID}:${e.TWILIO_API_KEY_SECRET}`;
  if (e.TWILIO_AUTH_TOKEN) return `${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`;
  return null;
}

export function channelStatus() {
  return {
    sms: !!(twilioAuth() && process.env.TWILIO_SMS_FROM),
    whatsapp: !!(twilioAuth() && process.env.TWILIO_WHATSAPP_FROM),
    email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };
}

// Haitian numbers to E.164: 8 local digits, with or without 509.
export function toE164(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 8) return `+509${d}`;
  if (d.length === 11 && d.startsWith('509')) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

export function render(kind, params, locale) {
  const t = getDict(locale);
  const template = t[`notif_${kind}`] || kind;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params?.[k] ?? ''));
}

async function withTimeout(promise, ms = 8000) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function sendTwilio(to, body, whatsapp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const from = whatsapp ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}` : process.env.TWILIO_SMS_FROM;
  const form = new URLSearchParams({ To: whatsapp ? `whatsapp:${to}` : to, From: from, Body: body });
  const res = await withTimeout(fetch(`${TWILIO_BASE()}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(twilioAuth()).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  }));
  if (!res.ok) throw new Error(`twilio ${res.status}`);
}

async function sendEmail(to, subject, text) {
  const res = await withTimeout(fetch(`${RESEND_BASE()}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  }));
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

async function sendExternal(account, text, link) {
  const ch = channelStatus();
  const url = link ? `${PUBLIC_BASE_URL()}${link.replace(/^\/(ht|fr|en)\//, `/${account.locale || 'ht'}/`)}` : PUBLIC_BASE_URL();
  const body = `Kay Ayiti: ${text}\n${url}`;
  const phone = toE164(account.phone);
  const jobs = [];
  if (ch.whatsapp && phone) jobs.push(['whatsapp', () => sendTwilio(phone, body, true)]);
  else if (ch.sms && phone) jobs.push(['sms', () => sendTwilio(phone, body, false)]);
  if (ch.email && account.email) jobs.push(['email', () => sendEmail(account.email, `Kay Ayiti — ${text.slice(0, 70)}`, body)]);
  for (const [channel, run] of jobs) {
    try {
      await run();
      log('info', 'notify.sent', { channel, username: account.username });
    } catch (e) {
      log('warn', 'notify.failed', { channel, username: account.username, message: e.message });
    }
  }
}

// Fire-and-forget: callers do not await delivery.
export function notify(username, kind, params = {}, { link = null, inApp = true, throttleKey = null } = {}) {
  if (!username) return;
  Promise.resolve().then(async () => {
    const { rows } = await query('SELECT username, phone, email, locale FROM accounts WHERE username = $1', [username]);
    const account = rows[0];
    if (!account) return;
    if (inApp) {
      await query(
        'INSERT INTO notifications (username, kind, params, link, created_at) VALUES ($1,$2,$3::jsonb,$4,$5)',
        [username, kind, JSON.stringify(params), link, Date.now()],
      );
    }
    if (throttleKey) {
      const key = `${username}|${throttleKey}`;
      const last = lastChatAlert.get(key) || 0;
      if (Date.now() - last < CHAT_THROTTLE_MS) return;
      lastChatAlert.set(key, Date.now());
      if (lastChatAlert.size > 20000) lastChatAlert.clear();
    }
    await sendExternal(account, render(kind, params, account.locale), link);
  }).catch((e) => log('error', 'notify.error', { kind, message: e.message }));
}

export async function listNotifications(username, limit = 50) {
  const { rows } = await query(
    'SELECT id, kind, params, link, created_at, read_at FROM notifications WHERE username = $1 ORDER BY created_at DESC LIMIT $2',
    [username, limit],
  );
  return rows.map((r) => ({ id: Number(r.id), kind: r.kind, params: r.params || {}, link: r.link, createdAt: Number(r.created_at), read: !!r.read_at }));
}

export async function unreadNotificationCount(username) {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE username = $1 AND read_at IS NULL', [username]);
  return rows[0].n;
}

export async function markAllRead(username) {
  await query('UPDATE notifications SET read_at = $2 WHERE username = $1 AND read_at IS NULL', [username, Date.now()]);
}
