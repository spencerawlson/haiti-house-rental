// Demo seed listings only — not real homes. Inserted into Postgres the
// first time the listings table is empty, and never again. Coordinates are
// approximate commune centers (for the map view only).
export const SEED_LISTINGS = [
  { id: 'pap-pv-001', type: 'house', department: 'ouest', commune: 'Pétion-Ville', price: 75000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Petyonvil', purpose: 'rent', lat: 18.512, lng: -72.285 },
  { id: 'pap-del-001', type: 'apartment', department: 'ouest', commune: 'Delmas', price: 40000, bedrooms: 2, bathrooms: 1, title: 'Apatman 2 chanm Dèlma', purpose: 'rent', lat: 18.542, lng: -72.299 },
  { id: 'pap-ken-001', type: 'house', department: 'ouest', commune: 'Kenscoff', price: 60000, bedrooms: 4, bathrooms: 3, title: 'Kay 4 chanm Kenskòf', purpose: 'rent', lat: 18.452, lng: -72.287 },
  { id: 'cap-001', type: 'house', department: 'nord', commune: 'Cap-Haïtien', price: 50000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Okap', purpose: 'rent', lat: 19.757, lng: -72.198 },
  { id: 'jac-001', type: 'house', department: 'sud-est', commune: 'Jacmel', price: 35000, bedrooms: 2, bathrooms: 1, title: 'Kay 2 chanm Jakmèl', purpose: 'rent', lat: 18.238, lng: -72.536 },
  { id: 'cay-001', type: 'house', department: 'sud', commune: 'Les Cayes', price: 30000, bedrooms: 3, bathrooms: 1, title: 'Kay 3 chanm Okay', purpose: 'rent', lat: 18.195, lng: -73.749 },
  { id: 'pap-land-001', type: 'land', department: 'ouest', commune: 'Arcahaie', price: 1500000, bedrooms: 0, bathrooms: 0, areaM2: 1200, title: 'Tèren 1200 m² Akayè', purpose: 'sale', lat: 18.772, lng: -72.514 },
];
