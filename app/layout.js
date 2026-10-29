import './globals.css';
import localFont from 'next/font/local';
import PresencePing from '@/components/PresencePing';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import OutboxFlusher from '@/components/OutboxFlusher';

// Nunito, self-hosted. next/font/google fetches from Google at build
// time, so a blocked or flaky fetch fails the whole build: it broke CI
// on main twice in a row with "An error occurred in next/font", and the
// same fetch runs in the FedServ rebuild, which is why a merge could
// stop deploying. Nothing is fetched now.
//
// The file is the variable woff2 Google itself serves for the latin
// subset — one file covers the whole weight axis, so this is the same
// typeface, not a substitute.
//
// weight is the font's real wght axis (200-1000, read from its fvar
// table), not the four weights the old config listed. The CSS asks for
// 900 in places, which those four could not actually render.
const nunito = localFont({
  src: './fonts/nunito-latin-var.woff2',
  weight: '200 1000',
  style: 'normal',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

// Defaults for every page, including link previews (WhatsApp, Facebook)
// of pages that do not set their own. metadataBase turns relative image
// paths into the absolute URLs previews require.
export const metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || 'https://kayayiti.app'),
  manifest: '/manifest.webmanifest',
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
export const viewport = { viewportFit: 'cover', themeColor: '#bae6fd' };

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
        <PresencePing />
        <ServiceWorkerRegister />
        <OutboxFlusher />
        {children}
      </body>
    </html>
  );
}
