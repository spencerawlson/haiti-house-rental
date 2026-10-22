// Who-is-who on a chat thread, from the session — never from the body.
// The listing owner picks which tenant's thread (`tenant`); anyone else
// is always the tenant of their own thread.
//
// A thread outlives its listing. When a landlord deletes a home the
// listing row goes but the conversation stays, so the tenant can still
// open and read it. In that case there is no listing to look up and the
// conversation stands in for it: `listing` is null and `closed` is true,
// which every caller treats as "readable, not writable".
import { getListing } from './listings-server';
import { getConversation } from './conversations-server';

export async function resolveThread(me, listingId, requestedTenant) {
  if (!listingId) return null;
  const listing = await getListing(listingId);
  // Callers use thread.listingId, never thread.listing.id: the listing is
  // null once the home is deleted, the id keeps working either way.
  if (listing) {
    const isOwner = !!listing.owner && listing.owner === me.username;
    // A home that is not active (taken down, sold, leased) takes no new
    // messages, but both sides can still read what was said.
    const closed = listing.status !== 'active';
    if (isOwner) {
      if (typeof requestedTenant !== 'string') return { listing, listingId, isOwner, tenant: null, closed, conversation: null };
      return { listing, listingId, isOwner, tenant: requestedTenant, closed, conversation: null };
    }
    return { listing, listingId, isOwner, tenant: me.username, closed, conversation: null };
  }
  // No listing row: only the tenant of an existing conversation may read
  // it. The landlord deleted the home and is out of the conversation.
  const conversation = await getConversation(listingId, me.username);
  if (!conversation) return null;
  return { listing: null, listingId, isOwner: false, tenant: me.username, closed: true, conversation };
}
