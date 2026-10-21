import { setFeatured } from '@/lib/listings';

// Admin approval for featured placement (75 HTG/month).
// v0: no auth on this route — the admin page is open. Gate it (password or
// account) before launch; never ship the public site with this open.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = setFeatured(data.id, data.featured);
  if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
  return Response.json({ listing });
}
