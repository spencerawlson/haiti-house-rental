import { getPromoCounts } from '@/lib/promo-server';

// Public promo counts for the sign-up and "post a home" pages, which are
// client components. The same numbers the landing page already renders
// for anonymous visitors: spots and spots left, nothing about any account.
// Nov 2026: both pools — landlord (spots/remaining) and seller
// (sellerSpots/sellerRemaining) — so signup can show the right pool
// for the role being chosen.
export const dynamic = 'force-dynamic';

export async function GET() {
  const counts = await getPromoCounts().catch(() => ({ spots: 0, remaining: 0, sellerSpots: 0, sellerRemaining: 0, sellerTagged: 0 }));
  return Response.json({
    spots: counts.spots,
    remaining: counts.remaining,
    sellerSpots: counts.sellerSpots ?? 0,
    sellerRemaining: counts.sellerRemaining ?? 0,
    sellerTagged: counts.sellerTagged ?? 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
