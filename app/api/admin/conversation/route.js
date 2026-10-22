import { getConversationById, getMessagesByConversation } from '@/lib/conversations-server';
import { audit } from '@/lib/audit';

// Moderator access: the admin reads one conversation by id — used to
// review a reported conversation. Gated by the middleware.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  const conv = await getConversationById(id);
  if (!conv) return Response.json({ error: 'Not found' }, { status: 404 });
  // Reading private messages is logged: moderation access is audited.
  await audit('admin', 'conversation.read', conv.id, { listingId: conv.listingId });
  return Response.json({ conversation: conv, messages: await getMessagesByConversation(conv) });
}
