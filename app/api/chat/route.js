import { getThread, postMessage, threadExists } from '@/lib/chat';
import { query } from '@/lib/db';
import { resolveThread } from '@/lib/chat-auth';
import { ensureConversation, getConversation } from '@/lib/conversations-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';
import { notify } from '@/lib/notify-server';
import { isTyping } from '@/lib/typing';

// Live data: never serve a build-time snapshot of a thread.
export const dynamic = 'force-dynamic';

// A thread is one listing + one tenant. Tenants read their own; the owner
// reads the tenant thread named by ?tenant=.
export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const params = new URL(request.url).searchParams;
  const thread = await resolveThread(me, params.get('listingId') || '', params.get('tenant'));
  if (!thread) return Response.json({ error: 'Listing not found' }, { status: 404 });
  if (thread.tenant === null) {
    return Response.json({ messages: [], isOwner: thread.isOwner, tenant: null, conversation: null, closed: false, landlordLeft: false });
  }
  const listingId = thread.listingId;
  const conv = thread.conversation || (await getConversation(listingId, thread.tenant));
  // Fraud suspension (0021): the counterpart sees only a neutral
  // "unavailable" — no reason, no label. The other side is the tenant
  // for the owner, and the listing owner (or the thread's landlord when
  // the home is gone) for the tenant.
  const otherUsername = thread.isOwner ? thread.tenant : (thread.listing?.owner || conv?.landlord || null);
  let otherSuspended = false;
  // Delivered = the other side's device has pinged the server (any page,
  // via PresencePing -> login_events.last_seen_at) since this message was
  // sent. Read = they've opened THIS thread (chat_reads). Both are read
  // for the OTHER person here — chat_reads is normally only ever queried
  // for "my own" row, for the unread badge.
  let readThroughAt = 0;
  let deliveredThroughAt = 0;
  if (otherUsername) {
    const { rows: susRows } = await query('SELECT fraud_suspended FROM accounts WHERE username = $1', [otherUsername]);
    otherSuspended = susRows[0]?.fraud_suspended === true;
    const { rows: readRows } = await query(
      'SELECT last_read_at FROM chat_reads WHERE listing_id = $1 AND tenant = $2 AND username = $3',
      [listingId, thread.tenant, otherUsername],
    );
    readThroughAt = Number(readRows[0]?.last_read_at || 0);
    // No ended_at filter: a session that has since ended still proves the
    // device was reachable at that timestamp, and "delivered" should stay
    // sticky rather than flicker off when they sign out.
    const { rows: seenRows } = await query('SELECT MAX(last_seen_at) AS t FROM login_events WHERE username = $1', [otherUsername]);
    deliveredThroughAt = Number(seenRows[0]?.t || 0);
  }
  return Response.json({
    otherSuspended,
    otherTyping: isTyping(thread.listingId, thread.tenant, thread.isOwner ? 'tenant' : 'owner'),
    readThroughAt,
    deliveredThroughAt,
    messages: await getThread(listingId, thread.tenant),
    isOwner: thread.isOwner,
    tenant: thread.tenant,
    conversation: conv ? { id: conv.id, blocked: !!conv.blockedBy, blockedByMe: conv.blockedBy === me.username } : null,
    // Readable but not writable. landlordLeft = the home was deleted, so
    // the other side is gone for good rather than just offline.
    closed: !!thread.closed,
    landlordLeft: !thread.listing,
    listingTitle: thread.listing?.title || conv?.listingTitle || null,
  });
}

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  // Fraud suspension blocks chat for either role: a suspended tenant
  // cannot write, and a suspended landlord cannot reply — the other
  // side sees the neutral "unavailable" line instead.
  if (me.fraudSuspended) return Response.json({ error: 'suspended' }, { status: 403 });
  if (!rateLimit(`chat:${me.username}`, 30, 60 * 1000)) return tooMany();
  const { listingId, text, tenant, audioUrl, audioDurationMs, audioPeaks } = await request.json().catch(() => ({}));
  // Voice-note fields are only ever trusted if they look like what step 3
  // (the upload route) just handed back — defense in depth, since the
  // real authorization boundary for who may upload into this thread
  // already lives in app/api/chat/upload-audio/route.js.
  let cleanAudioUrl = null;
  let cleanAudioDurationMs = null;
  let cleanAudioPeaks = null;
  if (audioUrl != null) {
    if (typeof audioUrl !== 'string' || !/^\/uploads\/[\w.-]+\.(weba|m4a)$/.test(audioUrl)) {
      return Response.json({ error: 'Invalid audio' }, { status: 400 });
    }
    if (typeof audioDurationMs !== 'number' || !Number.isFinite(audioDurationMs) || audioDurationMs <= 0 || audioDurationMs > 200000) {
      return Response.json({ error: 'Invalid audio' }, { status: 400 });
    }
    if (!Array.isArray(audioPeaks) || audioPeaks.length > 64 || !audioPeaks.every((p) => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1)) {
      return Response.json({ error: 'Invalid audio' }, { status: 400 });
    }
    cleanAudioUrl = audioUrl;
    cleanAudioDurationMs = audioDurationMs;
    cleanAudioPeaks = audioPeaks;
  }
  const thread = await resolveThread(me, listingId, tenant);
  if (!thread) return Response.json({ error: 'Listing not found' }, { status: 404 });
  // A closed thread takes no new messages. When the home was deleted the
  // landlord is out of the conversation for good, so say which it is and
  // let the tenant keep reading what is already there.
  if (thread.closed) {
    return Response.json({ error: thread.listing ? 'Listing not found' : 'landlord_left' }, { status: thread.listing ? 404 : 409 });
  }
  // The owner only replies inside an existing tenant thread, to a real
  // account (the anonymous legacy thread has nobody to read a reply).
  if (thread.isOwner && (!thread.tenant || !(await threadExists(thread.listingId, thread.tenant)))) {
    return Response.json({ error: 'No such conversation' }, { status: 400 });
  }
  // A blocked conversation takes no new messages from either side.
  const conv = await ensureConversation(thread.listing, thread.tenant);
  if (conv?.blockedBy) return Response.json({ error: 'blocked' }, { status: 403 });
  const msg = await postMessage({
    listingId: thread.listingId,
    sender: thread.isOwner ? 'owner' : 'tenant',
    tenant: thread.tenant,
    text,
    author: me.username,
    audioUrl: cleanAudioUrl,
    audioDurationMs: cleanAudioDurationMs,
    audioPeaks: cleanAudioPeaks,
  });
  if (!msg) return Response.json({ error: 'Invalid message' }, { status: 400 });
  // Tell the other side (SMS/email only — the Messages tab counts chats),
  // at most once per conversation every 15 minutes. A voice-only message
  // has no text to preview, so fall back to a locale-agnostic mic emoji —
  // notify() resolves the recipient's own locale internally, so there's no
  // translated string handy here to use instead.
  const recipient = thread.isOwner ? thread.tenant : thread.listing.owner;
  const link = `/ht/chats?listingId=${encodeURIComponent(thread.listingId)}${thread.isOwner ? '' : `&tenant=${encodeURIComponent(thread.tenant)}`}`;
  notify(recipient, 'chat', { name: String(me.name || '').split(/\s+/)[0], title: thread.listing.title, text: msg.text ? msg.text.slice(0, 80) : '🎤' }, {
    link, inApp: false, throttleKey: `${thread.listingId}|${thread.tenant}`,
  });
  return Response.json({ message: msg });
}
