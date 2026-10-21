// Demo seed data only — not real homes. Replaced by real listings once
// landlord accounts and payment activation ship.
export const LISTINGS = [
  { id: 'pap-pv-001', type: 'house', department: 'ouest', commune: 'Pétion-Ville', priceHTG: 75000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Pétion-Ville' },
  { id: 'pap-del-001', type: 'apartment', department: 'ouest', commune: 'Delmas', priceHTG: 40000, bedrooms: 2, bathrooms: 1, title: 'Apatman 2 chanm Delmas' },
  { id: 'pap-ken-001', type: 'house', department: 'ouest', commune: 'Kenscoff', priceHTG: 60000, bedrooms: 4, bathrooms: 3, title: 'Kay 4 chanm Kenscoff' },
  { id: 'cap-001', type: 'house', department: 'nord', commune: 'Cap-Haïtien', priceHTG: 50000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Okap' },
  { id: 'jac-001', type: 'house', department: 'sud-est', commune: 'Jacmel', priceHTG: 35000, bedrooms: 2, bathrooms: 1, title: 'Kay 2 chanm Jakmèl' },
  { id: 'cay-001', type: 'house', department: 'sud', commune: 'Les Cayes', priceHTG: 30000, bedrooms: 3, bathrooms: 1, title: 'Kay 3 chanm Okay' },
];

export function getListing(id) {
  return LISTINGS.find((l) => l.id === id) || null;
}
