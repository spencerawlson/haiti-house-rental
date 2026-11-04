// /sitemap.xml (Next metadata route): the public pages in all three
// locales plus every live house. Built per request so new listings show
// up without a rebuild; if the database is unreachable it still serves
// the static pages rather than failing.
import { getListings } from '@/lib/listings-server';

export const dynamic = 'force-dynamic';

const BASE = (process.env.PUBLIC_BASE_URL || 'https://kayayiti.app').replace(/\/$/, '');
const LOCALES = ['ht', 'fr', 'en'];

export default async function sitemap() {
  const pages = LOCALES.flatMap((l) => [
    { url: `${BASE}/${l}`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/${l}/listings`, changeFrequency: 'hourly', priority: 0.9 },
  ]);
  const listings = await getListings().catch(() => []);
  const homes = listings
    .filter((x) => x.status === 'active')
    .flatMap((x) => LOCALES.map((l) => ({
      url: `${BASE}/${l}/listings/${encodeURIComponent(x.id)}`,
      lastModified: x.createdAt ? new Date(x.createdAt) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    })));
  return [...pages, ...homes];
}
