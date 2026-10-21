import './globals.css';
import { Nunito } from 'next/font/google';
import PresencePing from '@/components/PresencePing';

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });

export const metadata = { title: 'Kay Ayiti — House rentals in Haiti' };

export default function RootLayout({ children }) {
  return (
    <html lang="ht">
      <body className={nunito.className}><PresencePing />{children}</body>
    </html>
  );
}
