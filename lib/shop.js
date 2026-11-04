// Shop sections (Nov 2026, Spencer): the furniture marketplace is
// STRUCTURED, not a random feed. Every item a seller posts belongs to
// exactly one section and one category inside that section, enforced
// server-side in app/api/listings/route.js. The Shop page shows the
// sections first; clicking one filters to only that section's items.
// No uncategorised feed exists anywhere in the Shop.
//
// Client-safe: no server imports, so pages and the post form can use it.
// Category/section labels live in the dictionaries (shopSection* /
// shopCat* keys) so all three locales render them.
export const SHOP_SECTIONS = [
  { id: 'furniture', categories: ['tables', 'chairs', 'beds', 'sofas'] },
  { id: 'textiles', categories: ['pillows', 'drapes', 'comforterCovers', 'blankets'] },
  { id: 'kitchen', categories: ['cookware', 'tableware'] },
  { id: 'decor', categories: ['rugs', 'mirrors'] },
  { id: 'lighting', categories: ['lamps'] },
  { id: 'electronics', categories: ['tvs', 'fans', 'refrigerators', 'washingMachines'] },
];

export function shopSectionIds() {
  return SHOP_SECTIONS.map((s) => s.id);
}

export function shopCategoriesFor(sectionId) {
  return SHOP_SECTIONS.find((s) => s.id === sectionId)?.categories || [];
}

// An item's section/category pair is valid only when the category
// belongs to that section — a pillow cannot sit under Furniture.
export function isValidShopCategory(sectionId, category) {
  return shopCategoriesFor(sectionId).includes(category);
}

// Dictionary labels for a section / category id ('furniture' ->
// t.shopSectionFurniture, 'comforterCovers' -> t.shopCatComforterCovers),
// falling back to the raw id. One helper so every page builds the key
// the same way.
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export function shopSectionLabel(t, id) {
  return (id && t[`shopSection${cap(id)}`]) || id || '';
}
export function shopCategoryLabel(t, id) {
  return (id && t[`shopCat${cap(id)}`]) || id || '';
}
