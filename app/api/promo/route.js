import { getPromoCounts } from '@/lib/promo-server';

// Public promo counts for the sign-up and "post a home" pages, which are
// client components. The same numbers the landing page already renders
// for anonymous visitors: spots and spots left, nothing about any account.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { spots, remaining } = await getPromoCounts().catch(() => ({ spots: 0, remaining: 0 }));
  return Response.json({ spots, remaining }, { headers: { 'Cache-Control': 'no-store' } });
}
