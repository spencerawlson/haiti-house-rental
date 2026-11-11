// /llms.txt as real text/plain. Without this route the [locale] segment
// catches "llms.txt" and serves the home page as HTML — the same trap
// robots.txt fell into before app/robots.js existed. A static route
// segment always beats the dynamic [locale] one.
const BASE = (process.env.PUBLIC_BASE_URL || 'https://kayayiti.app').replace(/\/$/, '');
const LOCALES = ['ht', 'fr', 'en'];

const PAGES = [
  ['', 'Home — find homes to rent or buy'],
  ['/listings', 'Listings — every home, with search and filters'],
  ['/advertise', 'Advertise — picture ads for any business'],
  ['/shop', 'Shop — furniture from the founder’s own store'],
];

function llmsText() {
  const lines = [
    '# Kay Ayiti',
    '',
    '> Find homes to rent or buy across all 10 departments of Haiti. Talk to the owner, schedule a visit. Free for landlords and tenants, forever; businesses pay to advertise.',
    '',
    '## Key pages',
    '',
  ];
  for (const [path, label] of PAGES) {
    for (const locale of LOCALES) {
      lines.push(`- [${label} (${locale})](${BASE}/${locale}${path})`);
    }
  }
  lines.push(
    '',
    '## Notes',
    '',
    '- Kay Ayiti is completely free for everyone, forever: landlords and tenants pay nothing. Only advertisers pay — picture ads (100–1,000 HTG), and advertisers see views and clicks counts only, never who saw the ad.',
    '- The furniture shop is the founder’s own store; outside sellers cannot list products.',
    `- The full sitemap is at ${BASE}/sitemap.xml.`,
  );
  return `${lines.join('\n')}\n`;
}

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(llmsText(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
