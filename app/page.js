import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '80px auto', padding: 24, textAlign: 'center' }}>
      <h1>Kay Ayiti</h1>
      <p>Jwenn kay pou lwe an Ayiti · Trouvez une maison à louer en Haïti · Find a home to rent in Haiti</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32 }}>
        <Link href="/ht">Kreyòl</Link>
        <Link href="/fr">Français</Link>
        <Link href="/en">English</Link>
      </div>
    </main>
  );
}
