import { markTransferSent } from '@/lib/accounts-server';

// The user sent the 1000 HTG activation transfer from the phone number on
// their account. The admin sees this flag + the number and activates.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const account = markTransferSent(data.username, data.provider);
  if (!account) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ account });
}
