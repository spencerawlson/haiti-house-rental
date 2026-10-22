import { hideThread } from '@/lib/chat';

// Delete a chat on the requester's side only — it leaves their inbox
// (and unread counts) but stays for the other side.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { listingId, username } = await request.json().catch(() => ({}));
  await hideThread(listingId, username);
  return Response.json({ ok: true });
}
