export const metadata = { title: 'Kay Ayiti — House rentals in Haiti' };

export default function RootLayout({ children }) {
  return (
    <html lang="ht">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f7f7f5', color: '#111' }}>
        {children}
      </body>
    </html>
  );
}
