import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';
import { resolveThread } from '@/lib/chat-auth';
import { threadExists } from '@/lib/chat';
import { getConversation } from '@/lib/conversations-server';
import { AUDIO_EXTS, matchesMagic, uploadExt, saveUpload } from '@/lib/upload-file';

// Voice note uploads. Separate from /api/upload (landlord-only, for listing
// photos/videos) because both sides of a chat — tenant or owner — need to
// send one. Auth mirrors every check app/api/chat/route.js POST already
// does, so this route can never write a file for a thread the caller has
// no business writing into.
//
// A dedicated rate-limit bucket on purpose, not the chat:<user> bucket the
// message-send route uses: that bucket (30/60s) is sized for cheap text
// inserts with zero disk I/O. 20/hour at an 8 MB cap tops out at 160 MB/hour
// — below the existing photo/video route's own ceiling (60/hour x 100MB),
// while still far larger than any real voice note (a 3-minute opus/aac
// clip is usually under 1MB).
const MAX_AUDIO = 8 * 1024 * 1024;

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (me.fraudSuspended) return Response.json({ error: 'suspended' }, { status: 403 });
  if (!rateLimit(`chat-audio:${me.username}`, 20, 60 * 60 * 1000)) return tooMany();
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'No form data' }, { status: 400 });
  const listingId = form.get('listingId');
  const tenantField = form.get('tenant');
  const thread = await resolveThread(me, listingId, typeof tenantField === 'string' ? tenantField : undefined);
  if (!thread) return Response.json({ error: 'Listing not found' }, { status: 404 });
  if (thread.closed) {
    return Response.json({ error: thread.listing ? 'Listing not found' : 'landlord_left' }, { status: thread.listing ? 404 : 409 });
  }
  // Owner only uploads into an existing tenant thread — same as the
  // message-send route, so this can never write an orphaned file for a
  // conversation that can never exist.
  if (thread.isOwner && (!thread.tenant || !(await threadExists(thread.listingId, thread.tenant)))) {
    return Response.json({ error: 'No such conversation' }, { status: 400 });
  }
  const conv = await getConversation(listingId, thread.tenant);
  if (conv?.blockedBy) return Response.json({ error: 'blocked' }, { status: 403 });
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file' }, { status: 400 });
  }
  if (!file.type.startsWith('audio/')) {
    return Response.json({ error: 'Only audio' }, { status: 400 });
  }
  const ext = uploadExt(file);
  if (!AUDIO_EXTS.includes(ext)) {
    return Response.json({ error: 'Unsupported file type' }, { status: 400 });
  }
  if (file.size > MAX_AUDIO) {
    return Response.json({ error: 'File too large' }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (!matchesMagic(buf, ext)) {
    return Response.json({ error: 'File content does not match its type' }, { status: 400 });
  }
  const url = await saveUpload(buf, ext);
  return Response.json({ url });
}
