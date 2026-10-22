import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getListing } from '@/lib/listings-server';
import ListingPhotos from '@/components/ListingPhotos';
import TabBar from '@/components/TabBar';

export const dynamic = 'force-dynamic';

// Photo gallery (design: docs/design/app-showcase.png, screen 8):
// "Photos (N)", room tabs (All / Inside / Outside / Surroundings — only
// the ones that have photos), a 2-column grid, zoom on tap.
const TAGS = ['inside', 'outside', 'area'];

export default async function ListingGallery(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const t = getDict(params.locale);
  const l = await getListing(params.id);
  if (!l || l.status !== 'active') notFound();
  const tags = l.details?.photoTags || {};
  const tab = TAGS.includes(searchParams.tag) ? searchParams.tag : '';
  const shown = tab ? l.photos.filter((p) => tags[p] === tab) : l.photos;
  const base = `/${params.locale}/listings/${l.id}`;
  const tabs = [{ id: '', label: t.all }, ...TAGS.filter((g) => l.photos.some((p) => tags[p] === g)).map((g) => ({ id: g, label: t[`photoTag_${g}`] }))];
  return (
    <>
      <main className="container">
        <header className="topbar" style={{ marginBottom: 8 }}>
          <Link href={base} className="icon-btn" aria-label={t.back}>←</Link>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>{t.photosTitle} ({l.photos.length})</h1>
          <span style={{ width: 42 }} />
        </header>
        {tabs.length > 1 && (
          <nav className="chip-row" aria-label={t.photosTitle} style={{ paddingTop: 4 }}>
            {tabs.map((g) => (
              <Link key={g.id || 'all'} className={`chip${tab === g.id ? ' active' : ''}`} href={g.id ? `${base}/photos?tag=${g.id}` : `${base}/photos`}>{g.label}</Link>
            ))}
          </nav>
        )}
        {shown.length === 0 ? (
          <p className="muted">{t.noPhotos}</p>
        ) : (
          <ListingPhotos photos={shown} placeholder="" grid />
        )}
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
