// /robots.txt (Next metadata route). Without this file the [locale]
// segment caught "robots.txt" and served the home page as HTML.
// Private and signed-in areas are not for search engines; everything
// public (home, listings, each listing page) is.
const BASE = (process.env.PUBLIC_BASE_URL || 'https://kayayiti.app').replace(/\/$/, '');

export default function robots() {
  const priv = ['account', 'admin', 'admin-login', 'admin-chat', 'chats', 'visits', 'payments', 'library', 'list', 'signin', 'signup', 'tenant-signup', 'forgot-password', 'stats', 'shop/post'];
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', ...priv.map((p) => `/*/${p}`)] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
