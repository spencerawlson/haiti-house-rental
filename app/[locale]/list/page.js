import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LISTING_FEE_LABEL, PAYMENT_PROVIDERS } from '@/lib/config';

export default function ListHome({ params }) {
  const t = getDict(params.locale);
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Link href={`/${params.locale}`}>{t.back}</Link>
      <h1>{t.landlordTitle}</h1>
      <ol>
        <li>{t.landlordStep1}</li>
        <li>{t.landlordStep2}</li>
        <li>{t.landlordStep3}</li>
      </ol>
      <form>
        <p>
          <label>{t.phoneLabel}<br />
            <input type="tel" placeholder="+509 ____ ____" />
          </label>
        </p>
        <p>
          {t.providerLabel}<br />
          {PAYMENT_PROVIDERS.map((p) => (
            <label key={p} style={{ marginRight: 16 }}>
              <input type="radio" name="provider" value={p} /> {p}
            </label>
          ))}
        </p>
        <p>{t.feeLabel}: <strong>{LISTING_FEE_LABEL}</strong> — {t.feeTbd}</p>
        <p style={{ color: '#666' }}>Payment integration is not live yet — this page documents the flow.</p>
      </form>
    </main>
  );
}
