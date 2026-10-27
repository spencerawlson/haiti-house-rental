import './globals.css';
import { Nunito } from 'next/font/google';
import PresencePing from '@/components/PresencePing';

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });

// Defaults for every page, including link previews (WhatsApp, Facebook)
// of pages that do not set their own. metadataBase turns relative image
// paths into the absolute URLs previews require.
export const metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || 'https://kayayiti.app'),
  title: 'Kay Ayiti — Kay pou lwe ak pou vann an Ayiti',
  description: 'Jwenn kay pou lwe oswa pou vann nan tout depatman Ayiti. Pale ak pwopriyetè a, pwograme yon vizit, gratis pou lokatè.',
  openGraph: {
    type: 'website',
    siteName: 'Kay Ayiti',
    title: 'Kay Ayiti — Kay pou lwe ak pou vann an Ayiti',
    description: 'Jwenn kay pou lwe oswa pou vann nan tout depatman Ayiti. Gratis pou lokatè.',
    images: [{ url: '/images/landing-house.jpg', width: 1200, height: 1200 }],
  },
  twitter: { card: 'summary_large_image' },
};

// viewport-fit=cover lets the safe-area env() vars report the real iPhone
// notch/Dynamic Island insets inside the Capacitor webview; without it
// safe-area-inset-top is 0 and the top bar slides under the status bar.
export const viewport = { viewportFit: 'cover' };

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
