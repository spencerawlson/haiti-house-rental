import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

// Uploaded house photos and videos, stored on the server's disk under
// public/uploads/. Honest limits: this works on a persistent server
// (self-hosted, like FedServ). On serverless hosting the disk is ephemeral,
// so production must swap this for object storage (S3/R2/Spaces).
// Limits: images 10 MB, videos 100 MB. No moderation yet.
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

function safeExt(name) {
  const ext = path.extname(name || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext || '.bin';
}

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'No form data' }, { status: 400 });
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file' }, { status: 400 });
  }
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    return Response.json({ error: 'Only images and videos' }, { status: 400 });
  }
  const limit = isImage ? MAX_IMAGE : MAX_VIDEO;
  if (file.size > limit) {
    return Response.json({ error: 'File too large' }, { status: 400 });
  }
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID()}${safeExt(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  return Response.json({ url: `/uploads/${name}`, kind: isImage ? 'photo' : 'video' });
}
