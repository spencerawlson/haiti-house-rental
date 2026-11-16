import { notFound } from 'next/navigation';
import { LOCALES } from '@/lib/config';

// The [locale] segment used to accept anything — getDict falls back to
// ht for an unknown locale — so /this-page-does-not-exist-12345,
// /.env and /favicon.ico all rendered the locale home with a 200
// (soft 404s; the favicon one also hid the missing favicon). An
// unknown first segment is now a real 404.
export default async function LocaleLayout(props) {
  const params = await props.params;
  if (!LOCALES.includes(params.locale)) notFound();
  return props.children;
}
