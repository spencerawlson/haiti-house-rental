// Who-is-who on a chat thread, from the session — never from the body.
// The listing owner picks which tenant's thread (`tenant`); anyone else
// is always the tenant of their own thread.
import { getListing } from './listings-server';

export async function resolveThread(me, listingId, requestedTenant) {
  const listing = listingId ? await getListing(listingId) : null;
  if (!listing) return null;
  const isOwner = !!listing.owner && listing.owner === me.username;
  if (isOwner) {
    if (typeof requestedTenant !== 'string') return { listing, isOwner, tenant: null };
    return { listing, isOwner, tenant: requestedTenant };
  }
  return { listing, isOwner, tenant: me.username };
}
