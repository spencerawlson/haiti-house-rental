'use client';

import Link from 'next/link';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { JOIN_FEE_HTG, QUARTER_FEE_HTG } from '@/lib/config';
import PromoPrice from '@/components/PromoPrice';
import { usePromo } from '@/lib/promo-client';

// Onboarding (design: docs/design/app-showcase.png, screen 2): three short
// slides after the first-visit splash — find a home, talk and visit,
// list your own home — with dots, a next arrow and Skip. Ends in the app.
const ART = ['/images/landing-house.jpg', '/images/landing-palms.jpg', '/images/landing-beach.jpg'];

export default function Welcome(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const router = useRouter();
  const [i, setI] = useState(0);
  const promo = usePromo();
  const promoOpen = Boolean(promo && promo.remaining > 0);
  const slides = [
    { title: t.onb1Title, text: t.onb1Text },
    { title: t.onb2Title, text: t.onb2Text },
    {
      title: t.onb3Title,
      // While promo spots remain: the joining fee struck through, and the
      // promo terms, instead of the normal prices.
      text: promoOpen ? (
        <>
          <PromoPrice amount={JOIN_FEE_HTG} free={t.free} /> ·{' '}
          {t.onb3PromoText.replace('{spots}', String(promo.spots)).replace('{quarter}', QUARTER_FEE_HTG.toLocaleString())}
        </>
      ) : t.onb3Text
        .replace('{fee}', JOIN_FEE_HTG.toLocaleString())
        .replace('{quarter}', QUARTER_FEE_HTG.toLocaleString()),
    },
  ];
  const last = i === slides.length - 1;
  const home = `/${params.locale}`;
  return (
    <main className="container onboarding">
      <p style={{ textAlign: 'right', margin: 0 }}>
        <Link href={home} style={{ fontWeight: 800 }}>{t.skip}</Link>
      </p>
      <img className="onb-art" src={ART[i]} alt="" />
      <h1 className="onb-title">{slides[i].title}</h1>
      <p className="onb-text">{slides[i].text}</p>
      <div className="onb-foot">
        <div className="onb-dots" aria-label={`${i + 1} / ${slides.length}`}>
          {slides.map((_, n) => (
            <button key={n} type="button" className={n === i ? 'active' : ''} onClick={() => setI(n)} aria-label={String(n + 1)} />
          ))}
        </div>
        <button type="button" className="onb-next" aria-label={last ? t.continueBtn : '→'} onClick={() => (last ? router.push(home) : setI(i + 1))}>→</button>
      </div>
    </main>
  );
}
