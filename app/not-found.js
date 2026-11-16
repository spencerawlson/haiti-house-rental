import Link from 'next/link';

// Unknown paths render this with a real 404 status (see
// app/[locale]/layout.js, which calls notFound() for an unknown locale).
// Kreyòl first — the site default — with links to the other languages.
export default function NotFound() {
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1>Paj la pa egziste (404)</h1>
      <p className="muted">Adrès sa a pa mennen okenn paj sou Kay Ayiti. Li te ka efase, oswa adrès la mal ekri.</p>
      <p>
        <Link className="btn" href="/ht">Ale nan paj dakèy la</Link>
      </p>
      <p className="muted">
        <Link href="/fr">Français</Link>
        {' · '}
        <Link href="/en">English</Link>
      </p>
    </main>
  );
}
