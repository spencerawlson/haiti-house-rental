import Link from 'next/link';
import TabBar from '@/components/TabBar';
import { getDict } from '@/lib/dictionaries';

// Privacy policy, required by the app stores. Short and honest: what the
// app stores, and the v0 limit that server memory resets on restart.
const TEXT = {
  ht: {
    title: 'Konfidansyalite',
    intro: 'Kay Ayiti respekte vi prive w. Men sa aplikasyon an kenbe, ak poukisa.',
    items: [
      'Kont ou: non konplè, non itilizatè, nimewo telefòn, imèl (si ou bay li) ak kote ou ye. Sa pèmèt ou konekte, epi admin an ka matche transfè MonCash/NatCash ou a ak kont ou.',
      'Kay ou mete yo: tit, pri, foto ak videyo ou telechaje yo. Yo vizib pou tout moun ki vizite sit la — pa mete enfòmasyon pèsonèl nan foto yo.',
      'Mesaj chat ak vizit: mesaj ou echanje ak lòt itilizatè yo, ak randevou vizit ou pwopoze yo.',
      'Peman: Kay Ayiti pa janm mande nimewo kat labank. Aktivasyon ak piblisite peye pa transfè MonCash oswa NatCash, admin an verifye yo alamen.',
      'Limit vèsyon sa a: done yo kenbe nan memwa sèvè a pou kounye a — si sèvè a rekòmanse, done yo efase. Yon baz done pèmanan ap vini.',
    ],
    back: 'Tounen',
  },
  fr: {
    title: 'Confidentialité',
    intro: 'Kay Ayiti respecte votre vie privée. Voici ce que l’application conserve, et pourquoi.',
    items: [
      'Votre compte : nom complet, nom d’utilisateur, numéro de téléphone, courriel (si vous le fournissez) et lieu. Cela vous permet de vous connecter, et permet à l’admin d’associer votre transfert MonCash/NatCash à votre compte.',
      'Vos maisons publiées : titre, prix, photos et vidéos que vous téléversez. Elles sont visibles par tous les visiteurs du site — n’y incluez pas d’informations personnelles.',
      'Messages et visites : les messages échangés avec les autres utilisateurs, et les rendez-vous de visite proposés.',
      'Paiements : Kay Ayiti ne demande jamais de numéro de carte bancaire. L’activation et la publicité se paient par transfert MonCash ou NatCash, vérifiés manuellement par l’admin.',
      'Limite de cette version : les données sont conservées en mémoire du serveur pour le moment — si le serveur redémarre, elles sont effacées. Une base de données permanente est prévue.',
    ],
    back: 'Retour',
  },
  en: {
    title: 'Privacy',
    intro: 'Kay Ayiti respects your privacy. Here is what the app keeps, and why.',
    items: [
      'Your account: full name, username, phone number, email (if you provide one) and location. This lets you sign in, and lets the admin match your MonCash/NatCash transfer to your account.',
      'Homes you post: title, price, photos and videos you upload. They are visible to everyone who visits the site — do not include personal information in them.',
      'Messages and visits: messages exchanged with other users, and visit appointments you propose.',
      'Payments: Kay Ayiti never asks for a bank card number. Activation and advertising are paid by MonCash or NatCash transfer, verified manually by the admin.',
      'Limit of this version: data is currently kept in server memory — if the server restarts, it is erased. A permanent database is coming.',
    ],
    back: 'Back',
  },
};

export default function Privacy({ params }) {
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
          <Link href={`/${params.locale}`}>{t.back}</Link>
        </p>
      </main>
      <TabBar locale={params.locale} browse={d.browse} favorites={d.favorites} explore={d.explore} account={d.account} />
    </>
  );
}
