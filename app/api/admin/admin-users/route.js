import { createAdminUser, listAdminUsers, deleteAdminUser } from '@/lib/admin-users-server';
import { audit } from '@/lib/audit';

// Named admin accounts. Middleware already restricts this route to the
// full admin: a scoped token gets a 401 before it reaches here, so a
// stats account can never create, list, or delete accounts — including
// one for itself.
export async function GET() {
  return Response.json({ users: await listAdminUsers() });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const result = await createAdminUser(data.username, data.password);
  if (result.error) {
    const status = result.error === 'exists' ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  await audit('admin', 'admin.admin_user_created', result.user.username);
  return Response.json({ user: result.user }, { status: 201 });
}

export async function DELETE(request) {
  const data = await request.json().catch(() => ({}));
  const removed = await deleteAdminUser(data.username);
  if (!removed) return Response.json({ error: 'not_found' }, { status: 404 });
  await audit('admin', 'admin.admin_user_deleted', String(data.username || '').trim());
  return Response.json({ ok: true });
}
