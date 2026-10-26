import { listReports, resolveReport } from '@/lib/reports-server';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify-server';

// Admin review of reports (gated by the middleware like every
// /api/admin/* route). GET lists open reports; POST resolves one.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const status = new URL(request.url).searchParams.get('status') === 'resolved' ? 'resolved' : 'open';
  return Response.json({ reports: await listReports(status) });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  // actionTaken is the closed loop: the reporter is told the report was
  // reviewed and whether action was taken — never what sanction, never
  // who else. Absent means no outcome was stated, so nobody is told.
  const outcome = data.actionTaken === true ? 'action' : data.actionTaken === false ? 'none' : null;
  const report = await resolveReport(String(data.id || ''), 'admin', outcome);
  if (!report) return Response.json({ error: 'Not found' }, { status: 404 });
  await audit('admin', 'report.resolved', report.id, { kind: report.kind, targetId: report.targetId, outcome });
  if (outcome) await notify(report.reporter, outcome === 'action' ? 'report_reviewed_action' : 'report_reviewed_none', {});
  return Response.json({ report });
}
