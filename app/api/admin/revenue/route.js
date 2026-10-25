import { getRevenue } from '@/lib/revenue-server';

// Admin-only (middleware gates /api/admin/*): revenue = every confirmed
// payment at its real amount (join, quarters, reactivation, advertising)
// plus manual activations made outside the payments ledger. Same total as
// the payment summary's "confirmed" figure.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getRevenue());
}
