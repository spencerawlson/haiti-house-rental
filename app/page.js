import Link from 'next/link';

export default function Home() {
  return (
    <main className="container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Kay <span style={{ color: '#1d4ed8' }}>Ayiti</span></h1>
      <p className="muted" style={{ fontSize: '1.1rem' }}>
        Jwenn kay pou lwe an Ayiti · Trouvez une maison à louer en Haïti · Find a home to rent in Haiti
      </p>
      <div className="lang-picker" style={{ marginTop: 40 }}>
        <Link className="btn" href="/ht">Kreyòl</Link>
        <Link className="btn" href="/fr">Français</Link>
        <Link className="btn" href="/en">English</Link>
      </div>
    </main>
  );
}
