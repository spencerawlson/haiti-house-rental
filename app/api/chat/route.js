import { getThread, postMessage } from '@/lib/chat';

// Live data: never serve a build-time snapshot of a thread.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const listingId = new URL(request.url).searchParams.get('listingId') || '';
  return Response.json({ messages: await getThread(listingId) });
}

export async function POST(request) {
  const { listingId, sender, text, author } = await request.json().catch(() => ({}));
  const msg = await postMessage(listingId, sender, text, author);
  if (!msg) return Response.json({ error: 'Invalid message' }, { status: 400 });
  return Response.json({ message: msg });
}
