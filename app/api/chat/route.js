import { getThread, postMessage } from '@/lib/chat';

export async function GET(request) {
  const listingId = new URL(request.url).searchParams.get('listingId') || '';
  return Response.json({ messages: getThread(listingId) });
}

export async function POST(request) {
  const { listingId, sender, text } = await request.json().catch(() => ({}));
  const msg = postMessage(listingId, sender, text);
  if (!msg) return Response.json({ error: 'Invalid message' }, { status: 400 });
  return Response.json({ message: msg });
}
