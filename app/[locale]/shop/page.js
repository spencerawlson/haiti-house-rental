import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { getFurnitureListings, getFurnitureSectionCounts } from '@/lib/listings-server';
import { SHOP_SECTIONS } from '@/lib/shop';
import { communeName } from '@/lib/departments';
import { photoSrc } from '@/lib/photo-url';
import TabBar from '@/components/TabBar';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

// Shop (Nov 2026, Spencer): "Mèble Kay Ou" — furnish your home.
// STRUCTURED: the sections come first, and clicking one filters to
// only that section's items. There is deliberately no uncategorised
// feed: without a ?section=, this page shows sections and nothing
// else. Every item shown here is a real seller item — no seed, no
// fake products, no fake prices — so an empty section says so plainly
// and points at seller signup instead of inventing stock.
//
// Buying in v1 is browse + contact the seller in the existing chat
// flow (the item detail page's contact button). There is NO on-site
// payment for Shop items yet, and the page says that plainly.
export default async function Shop(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
  const section = SHOP_SECTIONS.find((s) => s.id === searchParams.section) || null;
  const counts = await getFurnitureSectionCounts().catch(() => ({}));
  const items = section ? await getFurnitureListings(section.id).catch(() => []) : [];
  const sectionLabel = (id) => t[`shopSection${id[0].toUpperCase()}${id.slice(1)}`] || id;
  const categoryLabel = (cat) => t[`shopCat${cat[0].toUpperCase()}${cat.slice(1)}`] || cat;

  return (
    <>
      <main className="container">
        <h1 className="page-title">{t.shopTitle}</h1>
        <p style={{ marginTop: 0 }}>{t.shopSubline}</p>
        <p className="muted" style={{ marginTop: 0 }}>{t.shopBuyNote}</p>

        <h2 style={{ fontSize: '1.1rem' }}>{t.shopSectionsTitle}</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {SHOP_SECTIONS.map((s) => {
            const n = counts[s.id] ?? 0;
            const active = section?.id === s.id;
            return (
              <Link
                key={s.id}
                href={`${base}/shop?section=${s.id}`}
                className="card"
                aria-current={active ? 'page' : undefined}
                style={{ textDecoration: 'none', color: 'inherit', borderWidth: active ? 2 : undefined }}
              >
                <div className="card-body" style={{ display: 'grid', gap: 4 }}>
                  <strong>{sectionLabel(s.id)}</strong>
                  <span className="muted" style={{ fontSize: '0.88rem' }}>
                    {s.categories.map(categoryLabel).join(' · ')}
                  </span>
                  <span style={{ fontWeight: 800 }}>
                    {n === 0
                      ? t.shopNoItems.split('.')[0]
                      : `${n} ${params.locale === 'ht' ? 'atik' : params.locale === 'fr' ? (n > 1 ? 'articles' : 'article') : (n > 1 ? 'items' : 'item')}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {section && (
          <section style={{ marginTop: 24 }}>
            <p><Link href={`${base}/shop`}>← {t.shopSectionsTitle}</Link></p>
            <h2 style={{ fontSize: '1.2rem' }}>{sectionLabel(section.id)}</h2>
            {items.length === 0 ? (
              <section className="card">
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0 }}>{t.shopNoItems}</p>
                  <p style={{ margin: 0 }}><Link className="btn" href={`${base}/signup?role=seller`}>{t.shopBecomeSeller}</Link></p>
                </div>
              </section>
            ) : (
              <div className="grid">
                {items.map((item) => (
                  <article key={item.id} className="lcard">
                    <Link href={`${base}/listings/${item.id}`}>
                      {item.photos?.length > 0 ? (
                        <img className="lcard-photo" src={photoSrc(item.photos[0], 480)} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <div className="lcard-art">{communeName(item.commune, params.locale)}</div>
                      )}
                      <div className="lcard-body">
                        <h3 className="lcard-title">{item.title}</h3>
                        <p className="lcard-place">{sectionLabel(item.shopSection)} · {categoryLabel(item.shopCategory)} · {communeName(item.commune, params.locale)}</p>
                        <p className="lcard-price">{Number(item.price || 0).toLocaleString()} {item.currency || 'HTG'}</p>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!section && (
          <section className="card" style={{ marginTop: 24 }}>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              <p style={{ margin: 0 }}>{t.shopEmpty}</p>
              <p style={{ margin: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn" href={`${base}/signup?role=seller`}>{t.shopBecomeSeller}</Link>
                <Link className="btn btn-secondary" href={`${base}/shop/post`}>{t.shopPostItem}</Link>
              </p>
            </div>
          </section>
        )}
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
