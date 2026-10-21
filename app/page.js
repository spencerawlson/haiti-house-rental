import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { DEPARTMENTS } from '@/lib/departments';
import { LOCALES, ACTIVATION_FEE_HTG } from '@/lib/config';

// Landing page: the entry before the full app. Visitors pick a language,
// see what Kay Ayiti is, and step into the app through search, posting,
// or an account. No tab bar here — the app lives behind these doors.
// Who pays what is spelled out per audience, never in one shared line:
// tenants are free, landlords pay the one-time activation.
export default function Landing({ searchParams }) {
  const lang = LOCALES.includes(searchParams?.lang) ? searchParams.lang : 'ht';
  const t = getDict(lang);
  const gallery = [
    { src: '/images/landing-mountain.jpg', caption: t.galMountain },
    { src: '/images/landing-beach.jpg', caption: t.galBeach },
    { src: '/images/landing-house.jpg', caption: t.galHouse },
    { src: '/images/landing-palms.jpg', caption: t.galPalms },
  ];
  return (
    <main className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>Kay <span style={{ color: '#1d4ed8' }}>Ayiti</span></p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/?lang=ht">Kreyòl</Link>
          <Link href="/?lang=fr">Français</Link>
          <Link href="/?lang=en">English</Link>
        </div>
      </div>

      <section className="hero">
        <h1>{t.landingHero}</h1>
        <p>{t.landingSub}</p>
      </section>

      <form action={`/${lang}/listings`} method="get" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input name="q" className="input" placeholder={t.searchPlaceholder} style={{ flex: 1 }} />
        <button className="btn" type="submit">{t.browse}</button>
      </form>

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 4px' }}>{t.tenantLandingTitle}</h3>
            <p className="muted" style={{ margin: '0 0 12px' }}>{t.tenantLandingNote}</p>
            <Link className="btn" href={`/${lang}/tenants`}>{t.createTenantAccount}</Link>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 4px' }}>{t.landlordTitle}</h3>
            <p className="muted" style={{ margin: '0 0 12px' }}>{t.activationOnce} {ACTIVATION_FEE_HTG.toLocaleString()} HTG · {t.payNote}</p>
            <Link className="btn" href={`/${lang}/list`}>{t.postHome}</Link>
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 40 }}>{t.department}</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DEPARTMENTS.map((d) => (
          <Link key={d.id} className="chip" href={`/${lang}/listings?department=${d.id}`}>{d.id}</Link>
        ))}
      </div>

      <h2 style={{ marginTop: 40 }}>{t.howTitle}</h2>
      <div className="grid">
        <div className="card"><div className="card-body"><strong>1. {t.howStep1}</strong></div></div>
        <div className="card"><div className="card-body"><strong>2. {t.scheduleVisit}</strong></div></div>
        <div className="card"><div className="card-body"><strong>3. {t.howStep3}</strong></div></div>
      </div>

      <h2 style={{ marginTop: 40 }}>{t.galleryTitle}</h2>
      <div className="grid grid-2">
        {gallery.map((g) => (
          <figure key={g.src} style={{ margin: 0 }}>
            <img className="gallery-img" src={g.src} alt={g.caption} />
            <figcaption className="muted" style={{ marginTop: 4 }}>{g.caption}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
