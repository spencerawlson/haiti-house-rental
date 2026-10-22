import { updateVisit } from '@/lib/visits-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { notify } from '@/lib/notify-server';

// Change a visit: confirm / decline (the side that did not propose the
// current time), cancel, or reschedule with a new date + time (either
// side). Identity comes from the session. `status: confirmed|declined`
// is still accepted from older clients.
export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const data = await request.json().catch(() => ({}));
  const action = data.action || (data.status === 'confirmed' ? 'confirm' : data.status === 'declined' ? 'decline' : null);
  const result = await updateVisit(String(data.id || ''), me.username, { action, date: data.date, time: data.time });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  // Tell the other side of the visit what changed.
  const v = result.visit;
  const other = v.owner === me.username ? v.tenant : v.owner;
  const kind = { confirm: 'visit_confirmed', decline: 'visit_declined', cancel: 'visit_cancelled', reschedule: 'visit_rescheduled' }[action];
  if (kind) notify(other, kind, { name: String(me.name || '').split(/\s+/)[0], title: v.listingTitle, date: v.date, time: v.time }, { link: `/ht/listings/${encodeURIComponent(v.listingId)}` });
  return Response.json({ visit: result.visit });
}
