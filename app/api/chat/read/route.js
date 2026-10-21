import { markThreadRead } from '@/lib/chat';

// Opening a listing's chat marks its thread read for that user, so the
// unread badge clears when they have actually seen the messages.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { listingId, username } = await request.json().catch(() => ({}));
  await markThreadRead(listingId, username);
  return Response.json({ ok: true });
}
