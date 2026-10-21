import './globals.css';

export const metadata = { title: 'Kay Ayiti — House rentals in Haiti' };

export default function RootLayout({ children }) {
  return (
    <html lang="ht">
      <body>{children}</body>
    </html>
  );
}
