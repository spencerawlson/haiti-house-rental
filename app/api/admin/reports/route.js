import { listReports, resolveReport } from '@/lib/reports-server';
import { audit } from '@/lib/audit';

// Admin review of reports (gated by the middleware like every
// /api/admin/* route). GET lists open reports; POST resolves one.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const status = new URL(request.url).searchParams.get('status') === 'resolved' ? 'resolved' : 'open';
  return Response.json({ reports: await listReports(status) });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const report = await resolveReport(String(data.id || ''));
  if (!report) return Response.json({ error: 'Not found' }, { status: 404 });
  await audit('admin', 'report.resolved', report.id, { kind: report.kind, targetId: report.targetId });
  return Response.json({ report });
}
