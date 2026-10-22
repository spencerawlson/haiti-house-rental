import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';

// Little landing page for tenants: sign in or create a free account.
// No Gmail login — accounts are created here, with a username and a phone
// number, and tenants never pay the fee.
export default async function Tenants(props) {
  const params = await props.params;
  const t = getDict(params.locale);
  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1>{t.tenantLandingTitle}</h1>
        <p className="muted">{t.tenantLandingNote}</p>
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          <Link className="btn" href={`/${params.locale}/signin`}>{t.signIn}</Link>
          <Link className="btn btn-secondary" href={`/${params.locale}/tenant-signup`}>{t.createTenantAccount}</Link>
        </div>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
