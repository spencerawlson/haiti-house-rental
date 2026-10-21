# Kay Ayiti — House Rental App for Haiti

> Kay Ayiti se yon aplikasyon entènèt ki ede w jwenn kay pou lwe an Ayiti.
> Si w ap chèche yon kay, ou ka chèche pa depatman ak komin, wè pri yo, epi
> kontakte pwopriyetè a. Si w gen yon kay pou lwe, ou ka mete l sou
> aplikasyon an: ou peye yon ti frè ak MonCash oswa NatCash, epi nimewo
> telefòn ou aktive kont ou pou ou ka pibliye kay ou. Aplikasyon an disponib
> an kreyòl, fransè, ak anglè, epi li kouvri tout depatman peyi a — kòmanse
> Pòtoprens, epi Okap, Jakmèl, ak tout lòt kote.

Web-first house rental marketplace for Haiti. See `SPEC.md` for decisions.

- Launch city: Port-au-Prince; all 10 departments supported from day one.
- Two-sided: landlords list, tenants search. Tenants browse free.
- Landlord fee: placeholder (TBD, in discussion) — see `lib/config.js`.
- Payments: MonCash and NatCash mobile money (not cash). Payment from a
  phone number activates the account for posting.
- Languages: Kreyòl, Français, English.

## Develop

```sh
npm install
npm run dev
```

Mobile app (Capacitor) comes after the web app.
