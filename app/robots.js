// /robots.txt (Next metadata route). Without this file the [locale]
// segment caught "robots.txt" and served the home page as HTML.
// Private and signed-in areas are not for search engines; everything
// public (home, listings, each listing page) is.
//
// CAREFUL: robots.txt rules are PREFIX matches, so `/*/list` also matches
// `/ht/listings` and every `/[locale]/listings/<id>` page — that blocked
// all listing pages from Google indexing (Search Console, Nov 19 2026).
// `list` is the only entry that is a prefix of a public path, so it alone
// gets the `$` end anchor: `/*/list$` blocks only the landlord posting
// form at `/[locale]/list` and nothing under `/listings`.
const BASE = (process.env.PUBLIC_BASE_URL || 'https://kayayiti.app').replace(/\/$/, '');

export default function robots() {
  const priv = ['account', 'admin', 'admin-login', 'admin-chat', 'chats', 'visits', 'payments', 'library', 'list', 'signin', 'signup', 'tenant-signup', 'forgot-password', 'stats', 'shop/post'];
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', ...priv.map((p) => `/*/${p}${p === 'list' ? '$' : ''}`)] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
