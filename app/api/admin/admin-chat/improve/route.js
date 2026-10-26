import { isAdminCookie } from '@/lib/admin-auth';
import { improveDraft } from '@/lib/ai-improve';

// AI reply assist, admin chats only. GET reports availability without
// calling the provider, so the composer can hide the button when there
// is no key: the feature is key-optional by design, never an error
// state. POST improves one draft on the admin's explicit tap — nothing
// here runs automatically, and no draft or rewrite is ever logged.
export const dynamic = 'force-dynamic';

async function isAdmin(request) {
  return isAdminCookie(request.cookies.get('kay_admin')?.value);
}

export async function GET(request) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  return Response.json({ available: !!process.env.OPENAI_API_KEY });
}

export async function POST(request) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ available: false });
  const { text, locale } = await request.json().catch(() => ({}));
  const improved = await improveDraft(text, locale);
  if (!improved) return Response.json({ error: 'improve_failed' }, { status: 502 });
  return Response.json({ improved });
}
