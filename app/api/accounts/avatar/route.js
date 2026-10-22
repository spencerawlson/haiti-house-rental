import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { setAccountAvatar } from '@/lib/accounts-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';
import { IMAGE_EXTS, matchesMagic, uploadExt, saveUpload } from '@/lib/upload-file';

// Profile photo. Separate from /api/upload on purpose: that route is for
// listing media and only activated landlords may use it, but EVERY
// signed-in account has a profile — tenants included, and they never post
// a listing and are never "activated". So the gate here is simply "signed
// in", and the payload is narrower than a listing upload:
//
// - images only (no video),
// - the formats app/uploads/[file] serves, magic-byte checked,
// - 8 MB, which is generous: lib/image-compress.js shrinks the photo in
//   the browser first and usually lands at 200–500 KB. The cap is for the
//   browser that cannot decode the file and sends the original.
// - 10 changes an hour per account.
//
// The stored value is the path THIS server wrote. A URL from the client is
// never accepted (see setAccountAvatar), so a profile photo cannot be
// pointed at an external tracker.
const MAX_AVATAR = 8 * 1024 * 1024;

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (!rateLimit(`avatar:${me.username}`, 10, 60 * 60 * 1000)) return tooMany();
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'No form data' }, { status: 400 });
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: 'Only images' }, { status: 400 });
  }
  const ext = uploadExt(file);
  if (!IMAGE_EXTS.includes(ext)) {
    return Response.json({ error: 'Unsupported file type' }, { status: 400 });
  }
  if (file.size > MAX_AVATAR) {
    return Response.json({ error: 'File too large' }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (!matchesMagic(buf, ext)) {
    return Response.json({ error: 'File content does not match its type' }, { status: 400 });
  }
  const url = await saveUpload(buf, ext);
  const account = await setAccountAvatar(me.username, url);
  if (!account) return Response.json({ error: 'Could not save the photo' }, { status: 400 });
  return Response.json({ account });
}

// Remove the photo: the initials circle comes back.
export async function DELETE(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const account = await setAccountAvatar(me.username, null);
  if (!account) return Response.json({ error: 'Could not remove the photo' }, { status: 400 });
  return Response.json({ account });
}
