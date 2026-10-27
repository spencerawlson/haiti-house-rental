import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSessionAccount } from '@/lib/session-server';
import { getPromoCounts } from '@/lib/promo-server';
import { getDict } from '@/lib/dictionaries';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import { LOCALES, JOIN_FEE_HTG, QUARTER_FEE_HTG, PROMO_SHOW_COUNT_AT } from '@/lib/config';
import Icon from '@/components/Icon';
import PromoPrice from '@/components/PromoPrice';
import LandingLangSwitch from '@/components/LandingLangSwitch';
import Splash from '@/components/Splash';

// Landing page: the entry before the full app (after the first-visit
// splash, components/Splash.jsx). The top right stays clean —
// no language links here. Language is chosen once, in Account → Settings,
// and remembered in the kay_locale cookie, which this page reads.
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
  const fill = (s) => s
    .replaceAll('{remaining}', String(promo?.remaining ?? ''))
    .replaceAll('{spots}', String(promo?.spots ?? ''))
    .replaceAll('{quarter}', QUARTER_FEE_HTG.toLocaleString('en-US'));
  const backgrounds = [
    '/images/landing-mountain.jpg',
    '/images/landing-beach.jpg',
    '/images/landing-house.jpg',
    '/images/landing-palms.jpg',
  ];
  return (
    <>
      <div className="landing-bg" aria-hidden="true">
        {backgrounds.map((src) => (
          <img key={src} src={src} alt="" />
        ))}
        <div className="landing-wash" />
      </div>
      <main className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>Kay <span style={{ color: '#1d4ed8' }}>Ayiti</span></p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {me ? (
              <Link className="btn btn-secondary" href={`/${lang}/account`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.tabAccount}</Link>
            ) : (
              <Link className="btn btn-secondary" href={`/${lang}/signin`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.signIn}</Link>
            )}
            <LandingLangSwitch current={lang} />
          </div>
        </div>

        <section className="hero">
          <h1>{t.landingHero}</h1>
          <p>{t.landingSub}</p>
        </section>

        {/* Search first: most visitors are looking for a home. */}
        <form action={`/${lang}/listings`} method="get" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input name="q" className="input" placeholder={t.searchPlaceholder} style={{ flex: 1 }} />
          <button className="btn" type="submit">{t.browse}</button>
        </form>

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
              <p className="muted" style={{ margin: '0 0 12px' }}>
                {promoOpen ? (
                  <>
                    {t.activationOnce} <PromoPrice amount={JOIN_FEE_HTG} free={t.free} /> · {t.quarterFeeLabel}: <PromoPrice amount={QUARTER_FEE_HTG} free={t.promoFirstYear} />
                  </>
                ) : (
                  <>{t.activationOnce} {JOIN_FEE_HTG.toLocaleString()} HTG · {t.quarterFeeLabel}: {QUARTER_FEE_HTG.toLocaleString()} HTG · {t.payNote}</>
                )}
              </p>
              <Link className="btn" href={`/${lang}/list`}>{t.postHome}</Link>
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: 40 }}>{t.department}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEPARTMENTS.map((d) => (
            <Link key={d.id} className="chip" href={`/${lang}/listings?department=${d.id}`}>{departmentName(d.id, lang)}</Link>
          ))}
        </div>

        <h2 style={{ marginTop: 40 }}>{t.howTitle}</h2>
        <div className="grid">
          <div className="card"><div className="card-body"><strong>1. {t.howStep1}</strong></div></div>
          <div className="card"><div className="card-body"><strong>2. {t.scheduleVisit}</strong></div></div>
          <div className="card"><div className="card-body"><strong>3. {t.howStep3}</strong></div></div>
        </div>
        <p className="muted" style={{ marginTop: 32 }}>
          <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
        </p>
      </main>
    </>
  );
}
