import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSessionAccount } from '@/lib/session-server';
import { getPromoCounts } from '@/lib/promo-server';
import { getDict } from '@/lib/dictionaries';
import { getListings } from '@/lib/listings-server';
import { DEPARTMENTS, departmentName, communeName } from '@/lib/departments';
import { LOCALES, JOIN_FEE_HTG, QUARTER_FEE_HTG, PROMO_SHOW_COUNT_AT } from '@/lib/config';
import Icon from '@/components/Icon';
import PromoPrice from '@/components/PromoPrice';
import LandingLangSwitch from '@/components/LandingLangSwitch';
import LandingNavMenu from '@/components/LandingNavMenu';
import ListingCard from '@/components/ListingCard';
import Splash from '@/components/Splash';

// Landing page: the entry before the full app (after the first-visit
// splash, components/Splash.jsx).
//
// What this page deliberately does NOT say, and why:
//
// - No "verified listings" or "trusted owners" banner. `verified` is a
//   per-listing admin check with no renter-facing definition, no expiry,
//   and it survives the owner editing the home afterwards. There is no
//   landlord-level verification at all — "activated" means a MonCash
//   transfer matched a phone number, not that anyone checked who the
//   person is. A trust badge on the busiest page of a rental site is a
//   promise somebody acts on, so it waits until there is a check behind
//   it. The value strip says only what the site actually does today.
//
// - No "Local Stores" nav item and no merchant call to action. Merchant
//   advertising does not exist yet (zero code), so the first thing a
//   prospective advertiser would click is a dead link.
//
// - Nothing is described as "handpicked". The homes below are the NEWEST
//   real listings, in the order the server returns them. Paid placement
//   is not mixed in: the advertised carousel lives in the app home, where
//   it is labelled.
//
// Prices render in whatever currency the landlord chose (0017), which is
// HTG for almost everything — ListingCard handles it. Nothing here
// invents a price, a home, or a figure.
const HERO_IMAGE = '/images/landing-mountain.jpg';

// Quick links, taken from the real commune list so each one resolves to
// an actual search rather than a free-text guess.
const QUICK_COMMUNES = ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Cap-Haïtien', 'Jacmel', 'Les Cayes'];

// HTG bands. "Any price" first, so the default asks nothing of a visitor
// who does not yet know what things cost.
const PRICE_BANDS = [10000, 25000, 50000, 100000];

export default async function Landing() {
  const jar = await cookies();
  const saved = jar.get('kay_locale')?.value;
  // First visit (no language saved yet): the screen-1 splash with the
  // language choice, then onboarding. Every later visit lands here.
  if (!LOCALES.includes(saved)) return <Splash />;
  const lang = LOCALES.includes(saved) ? saved : 'ht';
  const t = getDict(lang);
  // Offering "Konekte" to somebody who is already signed in sent them to
  // a sign-in form for an account they were using. The real session is
  // checked here (this is a server component, so it can), and the button
  // becomes "Kont". getSessionAccount only needs something with
  // .cookies.get, which the next/headers jar provides.
  const me = await getSessionAccount({ cookies: jar }).catch(() => null);
  // Promo announcement (0022): the same remaining count the Admin
  // Board shows, rendered server-side for anonymous visitors. Count
  // only, nothing about any account. A failed count hides the banner
  // instead of breaking the landing page.
  const promo = await getPromoCounts().catch(() => null);
  const promoOpen = Boolean(promo && promo.remaining > 0);
  const showCount = promoOpen && promo.remaining <= PROMO_SHOW_COUNT_AT;
  // Real homes, newest first. A failure here must not take the landing
  // page down with it — the page is still useful without the strip.
  const listings = await getListings().catch(() => []);
  const newest = listings.slice(0, 3);
  const fill = (s) => s
    .replaceAll('{remaining}', String(promo?.remaining ?? ''))
    .replaceAll('{spots}', String(promo?.spots ?? ''))
    .replaceAll('{quarter}', QUARTER_FEE_HTG.toLocaleString('en-US'));

  const why = [
    { icon: 'heart', text: t.whyFree },
    { icon: 'chat', text: t.whyPrivate },
    { icon: 'calendar', text: t.whyVisit },
    { icon: 'flag', text: t.whyReport },
  ];

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></svg>
          Kay <span>Ayiti</span>
        </Link>
        <nav className="lp-links" aria-label="Kay Ayiti">
          <Link href={`/${lang}/listings?purpose=rent`}>{t.forRent}</Link>
          <Link href={`/${lang}/listings?purpose=sale`}>{t.forSale}</Link>
          <Link href={`/${lang}/list`}>{t.postHome}</Link>
        </nav>
        <div className="lp-nav-right">
          <LandingLangSwitch current={lang} />
          <Link className="lp-signin" href={`/${lang}/how-it-works`}>{t.howTitle}</Link>
          {me ? (
            <Link className="lp-signin" href={`/${lang}/account`}>{t.tabAccount}</Link>
          ) : (
            <Link className="lp-signin" href={`/${lang}/signin`}>{t.signIn}</Link>
          )}
          <Link className="btn lp-post" href={`/${lang}/list`}>{t.postHome}</Link>
          <LandingNavMenu
            accountHref={me ? `/${lang}/account` : `/${lang}/signin`}
            accountLabel={me ? t.tabAccount : t.signIn}
            postHref={`/${lang}/list`}
            postLabel={t.postHome}
            howHref={`/${lang}/how-it-works`}
            howLabel={t.howTitle}
          />
        </div>
      </header>

      <section className="lp-hero">
        {/* One image, not four. The landing used to stack every
            background in the DOM at once; on Haitian mobile data that is
            paid for by the visitor. Sized down and eager, since it is the
            first thing on the page. */}
        <img className="lp-hero-img" src={HERO_IMAGE} alt="" fetchPriority="high" decoding="async" />
        <div className="lp-hero-wash" aria-hidden="true" />
        <div className="lp-hero-inner">
          <h1>{t.landingHero}</h1>
          <p>{t.landingSub}</p>

          <form className="lp-search" action={`/${lang}/listings`} method="get" role="search">
            <div className="lp-purpose">
              <label><input type="radio" name="purpose" value="rent" defaultChecked /> <span>{t.forRent}</span></label>
              <label><input type="radio" name="purpose" value="sale" /> <span>{t.forSale}</span></label>
            </div>
            <div className="lp-fields">
              <div className="lp-field">
                <label htmlFor="lp-where">{t.whereLabel}</label>
                <select id="lp-where" name="department" defaultValue="">
                  <option value="">{t.whereAny}</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{departmentName(d.id, lang)}</option>
                  ))}
                </select>
              </div>
              <div className="lp-field">
                <label htmlFor="lp-price">{t.maxPrice}</label>
                <select id="lp-price" name="maxPrice" defaultValue="">
                  <option value="">{t.anyPrice}</option>
                  {PRICE_BANDS.map((p) => (
                    <option key={p} value={p}>{p.toLocaleString()} HTG</option>
                  ))}
                </select>
              </div>
              <button className="btn lp-go" type="submit">
                <Icon name="search" /> {t.tabSearch || t.browse}
              </button>
            </div>
          </form>

          <nav className="lp-chips" aria-label={t.department}>
            {QUICK_COMMUNES.map((c) => (
              <Link key={c} href={`/${lang}/listings?q=${encodeURIComponent(c)}`}>{communeName(c, lang)}</Link>
            ))}
            <Link className="lp-chip-more" href={`/${lang}/listings`}>{t.seeAll} →</Link>
          </nav>
        </div>

        {/* Only claims the site can actually back. */}
        <ul className="lp-why">
          {why.map((w) => (
            <li key={w.text}><Icon name={w.icon} /> {w.text}</li>
          ))}
        </ul>
      </section>

      <main className="container lp-main">
        {promoOpen && (
          <section className="card promo-banner">
            <div className="card-body">
              <h3><Icon name="sparkles" /> {t.promoLandingTitle}</h3>
              <p>{fill(t.promoLandingLimited)}</p>
              {showCount && (
                <>
                  <p><strong>{fill(t.promoLandingCount)}</strong></p>
                  <div className="promo-meter" role="progressbar" aria-valuemin={0} aria-valuemax={promo.spots} aria-valuenow={promo.spots - promo.remaining}>
                    <span style={{ width: `${Math.round(((promo.spots - promo.remaining) / promo.spots) * 100)}%` }} />
                  </div>
                </>
              )}
              <p className="promo-after">{fill(t.promoAfterYear)}</p>
              <Link className="btn promo-cta" href={`/${lang}/signup?role=landlord`}>{t.promoCta}</Link>
            </div>
          </section>
        )}

        {/* Real listings only. When there are barely any, say so rather
            than padding the page with invented homes. */}
        <div className="section-head">
          <h2>{t.newestHomes}</h2>
          <Link href={`/${lang}/listings`}>{t.seeAll} →</Link>
        </div>
        {newest.length === 0 ? (
          <section className="card" style={{ background: 'var(--primary-soft)' }}>
            <div className="card-body" style={{ display: 'grid', gap: 8 }}>
              <strong><Icon name="sprout" /> {t.earlyTitle}</strong>
              <span className="muted">{t.earlyText}</span>
              <Link className="btn" href={`/${lang}/list`}>＋ {t.postHome}</Link>
            </div>
          </section>
        ) : (
          <>
            {listings.length < 4 && <p className="muted">{t.earlyText}</p>}
            <div className="listing-grid">
              {newest.map((l) => (
                <ListingCard key={l.id} listing={l} locale={lang} t={t} />
              ))}
            </div>
          </>
        )}

        <div className="lp-cta">
          <div className="card">
            <div className="card-body">
              <h3>{t.tenantLandingTitle}</h3>
              <p className="muted">{t.tenantLandingNote}</p>
              <Link className="btn" href={`/${lang}/tenants`}>{t.createTenantAccount} →</Link>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <h3>{t.landlordTitle}</h3>
              <p className="muted">
                {promoOpen ? (
                  <>
                    {t.activationOnce} <PromoPrice amount={JOIN_FEE_HTG} free={t.free} /> · {t.quarterFeeLabel}: <PromoPrice amount={QUARTER_FEE_HTG} free={t.promoFirstYear} />
                  </>
                ) : (
                  <>{t.activationOnce} {JOIN_FEE_HTG.toLocaleString()} HTG · {t.quarterFeeLabel}: {QUARTER_FEE_HTG.toLocaleString()} HTG · {t.payNote}</>
                )}
              </p>
              <Link className="btn" href={`/${lang}/list`}>{t.postHome} →</Link>
            </div>
          </div>
        </div>


        <footer className="lp-footer">
          <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
        </footer>
      </main>
    </div>
  );
}
