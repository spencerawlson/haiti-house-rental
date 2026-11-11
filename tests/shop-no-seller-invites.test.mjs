// No public "sell furniture" invitations (Nov 2026): the Shop is the
// founder's store, but the website says nothing about that — the public
// invitations simply disappear. The signup role picker offers tenant /
// landlord only, the Shop page shows no Post button, and /shop/post shows
// no "Become a seller" card. The founder seller account keeps working
// through its gated screens (covered by 07-seller-shop.test.mjs, which
// also guards the API-side seller_signup_closed restriction).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE } from './helpers.mjs';

const get = (path) => fetch(`${BASE}${path}`).then(async (r) => ({ status: r.status, html: await r.text() }));

const POST_BUTTON = /Mete yon atik nan Boutik la|Publier un article dans la Boutique|Post an item in the Shop/;
const BECOME_SELLER = /Vin yon vandè|Devenir vendeur|Become a seller/;
const SELLER_ROLE = /Vandè mèb|Vendeur de meubles|Furniture seller/;

for (const locale of ['ht', 'fr', 'en']) {
  test(`/${locale}/shop shows no Post button and no seller invitation`, async () => {
    const { status, html } = await get(`/${locale}/shop`);
    assert.equal(status, 200);
    assert.doesNotMatch(html, POST_BUTTON, 'no public Post-an-item button');
    assert.doesNotMatch(html, BECOME_SELLER, 'no become-a-seller copy');
  });

  test(`/${locale}/shop/post shows no Become-a-seller card to an anonymous visitor`, async () => {
    const { status, html } = await get(`/${locale}/shop/post`);
    assert.equal(status, 200);
    assert.doesNotMatch(html, BECOME_SELLER, 'no become-a-seller card');
  });

  test(`/${locale}/signup offers no furniture-seller role`, async () => {
    const { status, html } = await get(`/${locale}/signup`);
    assert.equal(status, 200);
    assert.doesNotMatch(html, SELLER_ROLE, 'no seller role in the picker');
  });
}
