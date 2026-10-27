import Link from 'next/link';
import TabBar from '@/components/TabBar';
import { getDict } from '@/lib/dictionaries';

// Thank-you page — the Alert URL on the MonCash sandbox signup form
// (https://kayayiti.app/ht/moncash/merci, with /fr and /en twins).
// A payer lands here after completing a MonCash payment. The page
// promises nothing it cannot keep: a notification does not confirm a
// payment by itself. The admin verifies it, and the account page shows
// the activation once it is confirmed — exactly as with a manual
// transfer today.
const TEXT = {
  ht: {
    title: 'Mèsi!',
    intro: 'Nou resevwa notifikasyon peman MonCash ou a.',
    items: [
      'Administratè a ap verifye peman an. Lè li konfime, kont ou ap aktive (oswa piblisite w ap kòmanse) epi w ap wè sa sou paj kont ou a.',
      'Si ou pa wè chanjman an apre yon ti tan, kontakte administratè a — pa voye peman an yon dezyèm fwa.',
      'Kay Ayiti pa janm mande nimewo kat labank. Peman fèt sèlman pa transfè MonCash oswa NatCash.',
    ],
    account: 'Kont mwen',
    contactAdmin: 'Kontakte administratè a',
    home: 'Tounen lakay',
  },
  fr: {
    title: 'Merci !',
    intro: 'Nous avons reçu la notification de votre paiement MonCash.',
    items: [
      'L’administrateur va vérifier le paiement. Une fois confirmé, votre compte sera activé (ou votre publicité démarrera) et vous le verrez sur la page de votre compte.',
      'Si rien ne change après un moment, contactez l’administrateur — ne renvoyez pas le paiement une deuxième fois.',
      'Kay Ayiti ne demande jamais de numéro de carte bancaire. Les paiements se font uniquement par transfert MonCash ou NatCash.',
    ],
    account: 'Mon compte',
    contactAdmin: 'Contacter l’administrateur',
    home: 'Retour à l’accueil',
  },
  en: {
    title: 'Thank you!',
    intro: 'We received your MonCash payment notification.',
    items: [
      'The administrator will verify the payment. Once confirmed, your account will be activated (or your advertising will start) and you will see it on your account page.',
      'If nothing changes after a while, contact the administrator — do not send the payment a second time.',
      'Kay Ayiti never asks for a bank card number. Payments are made only by MonCash or NatCash transfer.',
    ],
    account: 'My account',
    contactAdmin: 'Contact admin',
    home: 'Back home',
  },
};

export default async function MonCashMerci(props) {
  const params = await props.params;
  const t = TEXT[params.locale] || TEXT.ht;
  const d = getDict(params.locale);
  return (
    <>
      <main className="container">
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <ul>
          {t.items.map((item, i) => (
            <li key={i} style={{ marginBottom: 12 }}>{item}</li>
          ))}
        </ul>
        <p>
          <Link href={`/${params.locale}/account`}>{t.account}</Link>
          {' · '}
          <Link href={`/${params.locale}/admin-chat`}>{t.contactAdmin}</Link>
          {' · '}
          <Link href={`/${params.locale}`}>{t.home}</Link>
        </p>
      </main>
      <TabBar locale={params.locale} browse={d.browse} favorites={d.favorites} explore={d.explore} account={d.account} />
    </>
  );
}
