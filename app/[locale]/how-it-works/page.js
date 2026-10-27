import Link from 'next/link';
import TabBar from '@/components/TabBar';
import { getDict } from '@/lib/dictionaries';

// How Kay Ayiti works, both sides, in plain language: what a person
// looking for a home does, what a landlord does and pays, and what stays
// private. The promo line never carries a number of its own — it points at
// the home page, where the live remaining count is shown while spots last.
const TEXT = {
  ht: {
    tenantTitle: 'Si w ap chèche kay',
    tenantSteps: [
      ['Chèche gratis', 'Chèche kay nan tout 10 depatman yo gratis — ou pa bezwen peye pou gade anons yo.'],
      ['Mesaje pwopriyetè a an prive', 'Voye mesaj prive bay pwopriyetè a nan app la, san ou pa pataje nimewo telefòn ou an piblik.'],
      ['Pwograme vizit la nan app la', 'Pwopoze lè ki bon pou ou, epi pwopriyetè a konfime oswa pwopoze yon lòt lè.'],
      ['Fè fas dirèkteman ak pwopriyetè a', 'Ou fè fas dirèkteman ak pwopriyetè a: Kay Ayiti pa pran komisyon, li pa kenbe kontra lwaye a ni lajan lwaye a.'],
    ],
    landlordTitle: 'Si ou gen kay pou mete',
    landlordSteps: [
      ['Kreye kont epi mete kay ou', 'Mete kay ou ak foto ak pri — an HTG oswa USD, pou lwe oswa pou vann.'],
      ['Peye epi aktive', 'Peye 1 500 HTG pou rantre, apre sa 1 000 HTG chak 3 mwa pou rete nan lis la, pa transfè MonCash oswa NatCash. Administratè a konfime peman an epi aktive kont ou.'],
      ['An vedèt, si ou vle', 'Si ou vle plis vizibilite, mete kay ou an vedèt pou yon montan ou chwazi ant 100 ak 1 000 HTG.'],
    ],
    promo: 'Pwomosyon: kounye a, pwopriyetè k ap rantre ka mete kay gratis pandan yon ane — paj akèy la montre konbyen plas ki rete toutotan genyen.',
    safetyTitle: 'Sekirite',
    safety: [
      'Adrès egzak kay la pa janm piblik: se komin nan ak yon pwen apwoksimatif sèlman ki parèt. Adrès egzak la parèt sèlman apre pwopriyetè a reponn ou nan chat la.',
      'Ou ka siyale nenpòt anons epi bloke itilizatè.',
      'Kay Ayiti pa janm mande nimewo kat labank ou.',
    ],
    searchHomes: 'Chèche kay',
    postHome: 'Mete kay ou',
    back: 'Tounen',
  },
  fr: {
    tenantTitle: 'Si vous cherchez une maison',
    tenantSteps: [
      ['Cherchez gratuitement', 'Cherchez dans les 10 départements, gratuitement — regarder les annonces ne coûte rien.'],
      ['Écrivez au propriétaire en privé', 'Envoyez un message privé au propriétaire dans l’application, sans partager votre numéro de téléphone en public.'],
      ['Programmez la visite dans l’application', 'Proposez les horaires qui vous conviennent, et le propriétaire confirme ou propose un autre horaire.'],
      ['Traitez directement avec le propriétaire', 'Vous traitez directement avec le propriétaire : Kay Ayiti ne prend aucune commission, et ne détient ni le bail ni le loyer.'],
    ],
    landlordTitle: 'Si vous avez une maison à publier',
    landlordSteps: [
      ['Créez un compte et publiez', 'Publiez votre maison avec photos et prix — en HTG ou en USD, à louer ou à vendre.'],
      ['Payez, puis activation', 'Payez 1 500 HTG pour adhérer, puis 1 000 HTG tous les 3 mois pour rester dans la liste, par transfert MonCash ou NatCash. L’administrateur confirme le paiement et active votre compte.'],
      ['En vedette, si vous voulez', 'Pour plus de visibilité, mettez votre maison en vedette pour un montant de votre choix entre 100 et 1 000 HTG.'],
    ],
    promo: 'Promotion : en ce moment, les propriétaires qui s’inscrivent peuvent publier gratuitement pendant un an — la page d’accueil indique combien de places restent tant qu’il y en a.',
    safetyTitle: 'Sécurité',
    safety: [
      'L’adresse exacte d’une maison n’est jamais publique : seule la commune et un point approximatif apparaissent. L’adresse exacte n’apparaît qu’une fois que le propriétaire vous a répondu dans la discussion.',
      'Vous pouvez signaler n’importe quelle annonce et bloquer des utilisateurs.',
      'Kay Ayiti ne demande jamais votre numéro de carte bancaire.',
    ],
    searchHomes: 'Chercher une maison',
    postHome: 'Publier une maison',
    back: 'Retour',
  },
  en: {
    tenantTitle: 'If you are looking for a home',
    tenantSteps: [
      ['Search free', 'Search homes in all 10 departments, free — browsing listings costs nothing.'],
      ['Message the owner privately', 'Send the owner a private message in the app, without sharing your phone number publicly.'],
      ['Schedule the visit in the app', 'Propose times that suit you, and the owner confirms or proposes another time.'],
      ['Deal directly with the owner', 'You deal directly with the owner: Kay Ayiti takes no commission, and holds neither the lease nor the rent.'],
    ],
    landlordTitle: 'If you have a home to list',
    landlordSteps: [
      ['Create an account and post', 'Post your home with photos and a price — in HTG or USD, for rent or for sale.'],
      ['Pay, then activation', 'Pay 1,500 HTG to join, then 1,000 HTG every 3 months to stay listed, by MonCash or NatCash transfer. The admin confirms the payment and activates your account.'],
      ['Featured, if you want', 'For extra visibility, feature your home for an amount you choose between 100 and 1,000 HTG.'],
    ],
    promo: 'Promotion: right now, landlords signing up can list free for a year — the home page shows how many spots are left while any remain.',
    safetyTitle: 'Safety',
    safety: [
      'A home’s exact address is never public: only the commune and an approximate pin show. The exact address appears only after the owner replies to you in chat.',
      'You can report any listing and block users.',
      'Kay Ayiti never asks for your bank card number.',
    ],
    searchHomes: 'Search homes',
    postHome: 'Post a home',
    back: 'Back',
  },
};

export default async function HowItWorks(props) {
  const params = await props.params;
  const t = TEXT[params.locale] || TEXT.ht;
  const d = getDict(params.locale);
  return (
    <>
      <main className="container">
        <h1>{d.howTitle}</h1>

        <h2>{t.tenantTitle}</h2>
        <ol>
          {t.tenantSteps.map(([title, body], i) => (
            <li key={i} style={{ marginBottom: 14 }}>
              <strong>{title}</strong>
              <div>{body}</div>
            </li>
          ))}
        </ol>

        <h2>{t.landlordTitle}</h2>
        <ol>
          {t.landlordSteps.map(([title, body], i) => (
            <li key={i} style={{ marginBottom: 14 }}>
              <strong>{title}</strong>
              <div>{body}</div>
            </li>
          ))}
        </ol>
        <p>
          <Link href="/">{t.promo}</Link>
        </p>

        <h2>{t.safetyTitle}</h2>
        <ul>
          {t.safety.map((item, i) => (
            <li key={i} style={{ marginBottom: 12 }}>{item}</li>
          ))}
        </ul>

        <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          <Link className="btn" href={`/${params.locale}/listings`}>{t.searchHomes}</Link>
          <Link className="btn" href={`/${params.locale}/list`}>{t.postHome}</Link>
        </p>
        <p>
          <Link href={`/${params.locale}`}>{t.back}</Link>
        </p>
      </main>
      <TabBar locale={params.locale} browse={d.browse} favorites={d.favorites} explore={d.explore} account={d.account} />
    </>
  );
}
