// A price the promo waives: the normal price struck through, then "Free".
// Shown wherever a landlord would otherwise read the normal fee while
// promo spots remain, so the page never contradicts the promo banner.
export default function PromoPrice({ amount, free }) {
  return (
    <>
      <s className="price-was">{`${Number(amount).toLocaleString('en-US')} HTG`}</s>{' '}
      <strong className="price-free">{free}</strong>
    </>
  );
}
