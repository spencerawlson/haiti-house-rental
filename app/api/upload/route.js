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

// Content check (Phase 1b): the file's first bytes must match its
// extension, so an HTML/script file renamed to .jpg is refused.
function matchesMagic(buf, ext) {
  const ascii = (start, end) => buf.subarray(start, end).toString('latin1');
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case '.png':
      return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case '.gif':
      return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a';
    case '.webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case '.avif':
      return ascii(4, 8) === 'ftyp' && ['avif', 'avis', 'mif1', 'msf1'].includes(ascii(8, 12));
    case '.mp4':
    case '.mov':
      // ISO base media: ftyp box (most files), or a QuickTime atom first.
      return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(ascii(4, 8));
    case '.webm':
      return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    default:
      return false;
  }
}

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
  const buf = Buffer.from(await file.arrayBuffer());
  if (!matchesMagic(buf, ext)) {
    return Response.json({ error: 'File content does not match its type' }, { status: 400 });
  }
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  await writeFile(path.join(dir, name), buf);
  return Response.json({ url: `/uploads/${name}`, kind: isImage ? 'photo' : 'video' });
}
