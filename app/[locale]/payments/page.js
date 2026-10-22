'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';
import { PaymentStatus } from '@/components/PaymentForm';

// My payments — every MonCash/NatCash reference I submitted, with its
// status (pending / confirmed / rejected and the admin's reason).
export default function Payments({ params }) {
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const session = getSession();
    setMe(session);
    if (!session) {
      setLoaded(true);
      return;
    }
    fetch('/api/payments')
      .then((r) => (r.ok ? r.json() : { payments: [] }))
      .then((d) => setPayments(d.payments || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1 className="page-title">💳 {t.myPayments}</h1>
        {loaded && !me && (
          <p><Link className="btn" href={`/${params.locale}/signin`}>{t.signIn}</Link></p>
        )}
        {loaded && me && payments.length === 0 && <p className="muted">{t.noPayments}</p>}
        <div className="grid">
          {payments.map((p) => (
            <section key={p.id} className="card">
              <div className="card-body"><PaymentStatus payment={p} strings={t} locale={params.locale} /></div>
            </section>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 20 }}>
          <Link href={`/${params.locale}/library`}>📣 {t.adStart} ›</Link>
        </p>
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
