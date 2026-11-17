import Link from 'next/link';
import { redirect } from 'next/navigation';
import TabBar from '@/components/TabBar';
import { getDict } from '@/lib/dictionaries';
import { SHOW_ADVERTISE } from '@/lib/config';

// Advertise on Kay Ayiti: a picture ad for any outside business, paid
// 100–1,000 HTG by MonCash/NatCash and shown once the admin confirms
// the payment. The advertiser sees views and clicks counts only —
// never who saw the ad. Follows the how-it-works page pattern: a
// server component, dictionary keys only, existing classes only.
//
// NOT OFFERED (Nov 17, 2026, Spencer — "we will not yet offer this
// service"): while SHOW_ADVERTISE is false this page redirects to the
// home page. The page stays in the repo so the service can be
// re-offered by flipping the flag.
export default async function Advertise(props) {
  const params = await props.params;
  if (!SHOW_ADVERTISE) redirect(`/${params.locale}`);
  const t = getDict(params.locale);
  return (
    <>
      <main className="container">
        <h1>{t.advertiseTitle}</h1>
        <p>{t.advertiseSub}</p>
        <p>{t.advertisePricing}</p>
        <p>{t.advertiseHow}</p>
        <p className="muted">{t.advertisePayNote}</p>
        <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          <Link className="btn" href={`/${params.locale}/signup?role=advertiser`}>{t.advertiseCta}</Link>
        </p>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
