import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSessionAccount } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// Uploaded house photos and videos, stored on the server's disk under
// public/uploads/. Honest limits: this works on a persistent server
// (self-hosted, like FedServ). On serverless hosting the disk is ephemeral,
// so production must swap this for object storage (S3/R2/Spaces).
// Limits: images 10 MB, videos 100 MB, 60 files an hour per account.
// Only activated landlord accounts upload (the only ones who post), and
// only the formats /uploads/[file] serves. No moderation yet.
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me || me.role !== 'landlord' || !me.activated) {
    return Response.json({ error: 'Only activated landlord accounts can upload' }, { status: 403 });
  }
  if (!rateLimit(`upload:${me.username}`, 60, 60 * 60 * 1000)) return tooMany();
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
  const ext = path.extname(file.name || '').toLowerCase();
  if (!(isImage ? IMAGE_EXTS : VIDEO_EXTS).includes(ext)) {
    return Response.json({ error: 'Unsupported file type' }, { status: 400 });
  }
  const limit = isImage ? MAX_IMAGE : MAX_VIDEO;
  if (file.size > limit) {
    return Response.json({ error: 'File too large' }, { status: 400 });
  }
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  return Response.json({ url: `/uploads/${name}`, kind: isImage ? 'photo' : 'video' });
}
