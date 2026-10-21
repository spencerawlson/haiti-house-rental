import { getInbox } from '@/lib/chat';

// Threads the signed-in user is part of, newest first, with unread counts.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const username = new URL(request.url).searchParams.get('username') || '';
  return Response.json({ threads: await getInbox(username) });
}
