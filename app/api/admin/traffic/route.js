import { trafficReport, reportToCsv, accountCounts, GRAINS } from '@/lib/traffic-server';

// Admin-only (middleware gates /api/admin/*): visitor and subscriber
// traffic, by day, week or month.
//
//   /api/admin/traffic?grain=weekly&from=2026-01-01&to=2026-03-31
//   /api/admin/traffic?grain=monthly&format=csv   -> download
//
// The CSV is rendered from the SAME report object the JSON returns, so a
// downloaded spreadsheet can never disagree with the figures on screen.
export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const grain = GRAINS.includes(searchParams.get('grain')) ? searchParams.get('grain') : 'daily';
  // Dates are validated rather than passed through: they reach a date
  // expression in SQL, and a parameter is no excuse for accepting junk.
  const from = DAY.test(searchParams.get('from') || '') ? searchParams.get('from') : null;
  const to = DAY.test(searchParams.get('to') || '') ? searchParams.get('to') : null;
  if (from && to && from > to) {
    return Response.json({ error: 'from is after to' }, { status: 400 });
  }

  const report = await trafficReport({ grain, from, to });

  if (searchParams.get('format') === 'csv') {
    const name = `kayayiti-traffic-${grain}-${report.from}-to-${report.to}.csv`;
    // The BOM is what stops Excel reading UTF-8 as mojibake.
    return new Response('﻿' + reportToCsv(report), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  // The board's tiles need a handful of current counts, and this is
  // already its "numbers" request — two integers do not deserve a second
  // round trip. Skipped for CSV, which is a time series only.
  return Response.json({ ...report, counts: await accountCounts() });
}
