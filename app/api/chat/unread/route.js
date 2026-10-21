import { getUnreadTotal } from '@/lib/chat';

// Total unread messages for the tab-bar badge.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const username = new URL(request.url).searchParams.get('username') || '';
  return Response.json({ total: await getUnreadTotal(username) });
}
