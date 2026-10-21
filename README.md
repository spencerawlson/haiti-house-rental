# Kay Ayiti — House Rental App for Haiti

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
