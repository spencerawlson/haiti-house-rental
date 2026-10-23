// The Haiti calendar day, in one place.
//
// Haiti observes daylight saving (UTC-5 in winter, UTC-4 in summer), so
// the offset has to be read from the date rather than hardcoded — the
// same reason reminders-server derives it per date instead of assuming
// -5. 'en-CA' is the shortest way to a YYYY-MM-DD string.
//
// This lives on its own so the modules that need a day — visits, traffic
// reports — do not have to import each other for it. traffic-server
// reaching into visits-server pulled in the whole listings chain behind
// it, which is a lot of module graph for one line, and would have become
// an import cycle the first time listings came to depend on billing.
export function haitiToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port-au-Prince' });
}

// The same conversion in SQL, for grouping epoch-millisecond columns into
// Haiti days. Kept beside the JS version so the two can never drift onto
// different timezones.
export const haitiDaySql = (col) =>
  `(to_timestamp(${col} / 1000.0) AT TIME ZONE 'America/Port-au-Prince')::date`;
