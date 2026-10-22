import { getThread, postMessage, threadExists } from '@/lib/chat';
import { resolveThread } from '@/lib/chat-auth';
import { ensureConversation, getConversation } from '@/lib/conversations-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';
import { notify } from '@/lib/notify-server';

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
  if (thread.tenant === null) return Response.json({ messages: [], isOwner: thread.isOwner, tenant: null, conversation: null });
  const conv = await getConversation(thread.listing.id, thread.tenant);
  return Response.json({
    messages: await getThread(thread.listing.id, thread.tenant),
    isOwner: thread.isOwner,
    tenant: thread.tenant,
    conversation: conv ? { id: conv.id, blocked: !!conv.blockedBy, blockedByMe: conv.blockedBy === me.username } : null,
  });
}

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (!rateLimit(`chat:${me.username}`, 30, 60 * 1000)) return tooMany();
  const { listingId, text, tenant } = await request.json().catch(() => ({}));
  const thread = await resolveThread(me, listingId, tenant);
  if (!thread || thread.listing.status !== 'active') {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  // The owner only replies inside an existing tenant thread, to a real
  // account (the anonymous legacy thread has nobody to read a reply).
  if (thread.isOwner && (!thread.tenant || !(await threadExists(thread.listing.id, thread.tenant)))) {
    return Response.json({ error: 'No such conversation' }, { status: 400 });
  }
  // A blocked conversation takes no new messages from either side.
  const conv = await ensureConversation(thread.listing, thread.tenant);
  if (conv?.blockedBy) return Response.json({ error: 'blocked' }, { status: 403 });
  const msg = await postMessage({
    listingId: thread.listing.id,
    sender: thread.isOwner ? 'owner' : 'tenant',
    tenant: thread.tenant,
    text,
    author: me.username,
  });
  if (!msg) return Response.json({ error: 'Invalid message' }, { status: 400 });
  // Tell the other side (SMS/email only — the Messages tab counts chats),
  // at most once per conversation every 15 minutes.
  const recipient = thread.isOwner ? thread.tenant : thread.listing.owner;
  const link = `/ht/chats?listingId=${encodeURIComponent(thread.listing.id)}${thread.isOwner ? '' : `&tenant=${encodeURIComponent(thread.tenant)}`}`;
  notify(recipient, 'chat', { name: String(me.name || '').split(/\s+/)[0], title: thread.listing.title, text: msg.text.slice(0, 80) }, {
    link, inApp: false, throttleKey: `${thread.listing.id}|${thread.tenant}`,
  });
  return Response.json({ message: msg });
}
