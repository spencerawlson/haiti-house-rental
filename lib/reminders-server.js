// Visit reminders. Both sides of a confirmed visit are nudged three
// times: two days before, one day before, and on the morning of the day.
//
// Run from the scheduled job (app/api/cron), not from page traffic: a
// 6 a.m. reminder has to go out at 6 a.m., and at 6 a.m. there may be
// nobody on the site to trigger anything.
//
// WINDOWS, not deadlines. Each reminder is only sent inside its own
// stretch of time:
//
//   two_days   [start - 48 h, start - 24 h)
//   one_day    [start - 24 h, 6 a.m. on the day)
//   morning    [6 a.m. on the day, start]
//
// That is what stops a visit confirmed two hours beforehand from firing
// all three at once — it gets the morning one only. It also means a
// reminder whose window has closed is simply skipped rather than arriving
// absurdly late: a cron outage loses a nudge instead of sending "in two
// days" ten minutes before the visit.
//
// Exactly-once is enforced by the claim in visit_reminders (one row per
// visit per kind). The claim is taken BEFORE sending: a crash mid-send
// loses a reminder rather than sending it twice, which is the right way
// round for something that costs money per SMS.
import { query } from './db';
import { notify } from './notify-server';
import { log } from './log';

export const REMINDER_KINDS = ['two_days', 'one_day', 'morning'];
const MORNING_HOUR = 6;

// Haiti observes daylight saving, so the offset is read from the date
// itself rather than hardcoded. Comparing the same instant formatted in
// Haiti and in UTC gives the offset in minutes.
function haitiOffsetMs(atMs) {
  const d = new Date(atMs);
  const haiti = new Date(d.toLocaleString('en-US', { timeZone: 'America/Port-au-Prince' }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return haiti.getTime() - utc.getTime();
}

// 'YYYY-MM-DD' + 'HH:MM' as Haiti wall-clock -> epoch ms. One correction
// pass, which is exact except for an instant that straddles a DST change.
export function haitiWallClockToMs(date, time) {
  const naive = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(naive)) return NaN;
  return naive - haitiOffsetMs(naive);
}

// Which reminder, if any, is due for this visit right now.
export function dueReminder(visit, now = Date.now()) {
  const start = haitiWallClockToMs(visit.date, visit.time);
  if (Number.isNaN(start)) return null;
  const morning = haitiWallClockToMs(visit.date, `${String(MORNING_HOUR).padStart(2, '0')}:00`);
  const day = 86400000;
  if (now >= start - 2 * day && now < start - day) return 'two_days';
  // A visit early enough in the day can have 6 a.m. fall before the
  // 24-hour mark; the one-day window then simply ends at that mark.
  if (now >= start - day && now < Math.max(morning, start - day)) return 'one_day';
  if (now >= morning && now <= start) return 'morning';
  return null;
}

// Take the claim. Returns true only for the run that won it, so the
// caller can send exactly once.
async function claim(visitId, kind) {
  const { rowCount } = await query(
    `INSERT INTO visit_reminders (visit_id, kind, sent_at) VALUES ($1,$2,$3)
     ON CONFLICT (visit_id, kind) DO NOTHING`,
    [visitId, kind, Date.now()],
  );
  return rowCount === 1;
}

// A rescheduled visit needs a fresh set of nudges for its new date.
export async function clearVisitReminders(visitId) {
  await query('DELETE FROM visit_reminders WHERE visit_id = $1', [visitId]);
}

// Send every reminder that is due. Safe to call repeatedly.
export async function sendVisitReminders({ now = Date.now() } = {}) {
  // Only confirmed visits — a reminder for a time nobody agreed to is
  // noise. Window is generous on both sides of "soon"; dueReminder()
  // does the real filtering.
  const { rows } = await query(
    `SELECT id, listing_id, listing_title, owner, tenant, date, time
     FROM visits
     WHERE status = 'confirmed'
       AND date >= $1 AND date <= $2`,
    [
      new Date(now - 3 * 86400000).toISOString().slice(0, 10),
      new Date(now + 3 * 86400000).toISOString().slice(0, 10),
    ],
  );
  const sent = [];
  for (const v of rows) {
    const kind = dueReminder(v, now);
    if (!kind) continue;
    if (!(await claim(v.id, kind))) continue; // another run already has it
    const params = { title: v.listing_title, date: v.date, time: v.time };
    const link = `/ht/visits`;
    // Both sides, each in their own language (notify() looks that up).
    for (const who of [v.owner, v.tenant]) {
      if (who) notify(who, `visit_reminder_${kind}`, params, { link });
    }
    sent.push({ visitId: v.id, kind });
    log('info', 'reminder.sent', { visitId: v.id, kind, date: v.date, time: v.time });
  }
  return sent;
}
