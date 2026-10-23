import { timingSafeEqual } from 'crypto';
import { sweepSoldListings } from '@/lib/listings-server';
import { sendVisitReminders } from '@/lib/reminders-server';
import { sweepBilling } from '@/lib/billing-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';
import { log } from '@/lib/log';

// The scheduled job. Called by the `cron` service in docker-compose
// (scripts/cron-loop.sh) every few minutes.
//
// Why an HTTP endpoint and not a timer inside the app: the work needs the
// app's own code (migrations, notify, the sweep), and a loop in a tiny
// container is the pattern this project already uses for backups. It also
// means the schedule is visible in docker-compose instead of buried in a
// module, and restarting the app cannot silently stop it.
//
// Guarded by CRON_SECRET, compared in constant time. With no secret set
// the endpoint is CLOSED (503) rather than open — the same fail-closed
// rule the admin area uses. This route is reachable from the internet
// through the tunnel, so the secret is the only thing standing in front
// of it; it is rate-limited as well, so it cannot be hammered blindly.
export const dynamic = 'force-dynamic';

function secretOk(given) {
  const want = process.env.CRON_SECRET || '';
  if (!want || typeof given !== 'string' || given.length === 0) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function run(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'cron disabled: CRON_SECRET is not set' }, { status: 503 });
  }
  if (!rateLimit(`cron:${clientIp(request)}`, 60, 60 * 60 * 1000)) return tooMany();
  const url = new URL(request.url);
  const given = request.headers.get('x-cron-key') || url.searchParams.get('key') || '';
  if (!secretOk(given)) {
    log('warn', 'cron.rejected', { ip: clientIp(request) });
    return Response.json({ error: 'Not allowed' }, { status: 401 });
  }
  const started = Date.now();
  const result = { deletedListings: 0, remindersSent: 0, suspended: 0, deactivated: 0, errors: [] };
  // Each job is isolated: one failing must not stop the other, and the
  // reply says which failed instead of just 500ing.
  try {
    const deleted = await sweepSoldListings({ force: true });
    result.deletedListings = deleted.length;
  } catch (e) {
    result.errors.push(`sweep: ${e.message}`);
    log('error', 'cron.sweep_failed', { message: e.message });
  }
  try {
    const sent = await sendVisitReminders();
    result.remindersSent = sent.length;
    result.reminders = sent;
  } catch (e) {
    result.errors.push(`reminders: ${e.message}`);
    log('error', 'cron.reminders_failed', { message: e.message });
  }
  try {
    const billing = await sweepBilling();
    result.suspended = billing.suspended.length;
    result.deactivated = billing.deactivated.length;
  } catch (e) {
    result.errors.push(`billing: ${e.message}`);
    log('error', 'cron.billing_failed', { message: e.message });
  }
  result.ms = Date.now() - started;
  log('info', 'cron.ran', result);
  return Response.json(result, { status: result.errors.length ? 500 : 200 });
}

export async function POST(request) {
  return run(request);
}

// GET too, so the schedule can be checked by hand with curl.
export async function GET(request) {
  return run(request);
}
