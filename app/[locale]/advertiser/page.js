import { redirect } from 'next/navigation';
import { SHOW_ADVERTISE } from '@/lib/config';
import AdvertiserDashboard from './AdvertiserDashboard';

// An advertiser's dashboard lives in AdvertiserDashboard.jsx (client
// component). This server wrapper exists so the whole service can be
// hidden behind SHOW_ADVERTISE: while the flag is false the dashboard
// redirects to the home page before any of its markup is served, the
// same way /{locale}/advertise does. NOT OFFERED (Nov 17, 2026,
// Spencer — "we will not yet offer this service"). Flip the flag back
// to true and the dashboard is offered again, no code changes needed.
export default async function Advertiser(props) {
  const params = await props.params;
  if (!SHOW_ADVERTISE) redirect(`/${params.locale}`);
  return <AdvertiserDashboard params={params} />;
}
