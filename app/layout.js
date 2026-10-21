import './globals.css';
import { Nunito } from 'next/font/google';
import PresencePing from '@/components/PresencePing';

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });

export const metadata = { title: 'Kay Ayiti — House rentals in Haiti' };

export default function RootLayout({ children }) {
  return (
    <html lang="ht">
      <body className={nunito.className}>
        {/* No-flash theme script: applies the stored theme (or the system
            preference when nothing is stored) before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kay_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
        <PresencePing />{children}
      </body>
    </html>
  );
}
