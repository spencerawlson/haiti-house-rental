import { createReadStream } from 'fs';
import { readFile, writeFile, mkdir, rename, stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';
import { PHOTO_WIDTHS } from '@/lib/photo-url';

// Serves uploaded house photos/videos from disk. Next's static handler
// does not serve files added to public/uploads at runtime in the
// standalone server (uploads returned success but their URLs 404'd on
// live) — so this route reads the same directory the upload route writes
// to and streams the file. Old /uploads/<name> URLs keep working, so
// photos uploaded before this route existed display without re-uploading.
//
// Sizes: ?w=320|480|800|1200 returns a resized copy — WebP, or JPEG with
// &f=jpg (link previews: WhatsApp/Facebook are safest with JPEG). It is
// made once with sharp, cached under uploads/.thumbs/, and from then on
// served from disk. Works for every photo already uploaded, with no
// migration. Any failure falls back to the original file.
export const dynamic = 'force-dynamic';

const TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.weba': 'audio/webm',
  '.m4a': 'audio/mp4',
};
const RESIZABLE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const CACHE = { 'Cache-Control': 'public, max-age=31536000, immutable' };

async function resized(full, file, width, jpg) {
  const dir = path.join(path.dirname(full), '.thumbs');
  const out = path.join(dir, `${path.parse(file).name}-${width}.${jpg ? 'jpg' : 'webp'}`);
  try {
    return await readFile(out);
  } catch {
    // not made yet
  }
  const { default: sharp } = await import('sharp');
  // limitInputPixels: refuse decompression bombs (a tiny file that
  // expands to gigapixels). Uploads are already capped at 10 MB.
  const pipeline = sharp(full, { limitInputPixels: 40_000_000 }).rotate().resize({ width, withoutEnlargement: true });
  const buf = jpg ? await pipeline.jpeg({ quality: 76, mozjpeg: true }).toBuffer() : await pipeline.webp({ quality: 72 }).toBuffer();
  await mkdir(dir, { recursive: true });
  // Write then rename, so a half-written file is never served.
  const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, buf);
  await rename(tmp, out).catch(() => {});
  return buf;
}

export async function GET(request, props) {
  const params = await props.params;
  const file = path.basename(params.file || '');
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!file || file.startsWith('.') || !type) {
    return new Response('Not found', { status: 404 });
  }
  const full = path.join(process.cwd(), 'public', 'uploads', file);

  const q = new URL(request.url).searchParams;
  const width = Number(q.get('w'));
  if (RESIZABLE.has(ext) && PHOTO_WIDTHS.includes(width)) {
    const jpg = q.get('f') === 'jpg';
    try {
      const buf = await resized(full, file, width, jpg);
      return new Response(buf, { headers: { 'Content-Type': jpg ? 'image/jpeg' : 'image/webp', ...CACHE } });
    } catch {
      // fall through to the original
    }
  }

  // Range requests (audio/video): Safari in particular refuses to play
  // <audio>/<video> from a server that doesn't honor Range — it probes
  // with a small range request before committing to play at all, so a
  // flat 200-with-the-whole-file response left voice notes silently
  // unplayable there.
  try {
    const stats = await stat(full);
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', ...CACHE };
    const range = request.headers.get('range');
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : stats.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stats.size}`, ...headers } });
      }
      return new Response(Readable.toWeb(createReadStream(full, { start, end })), {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stats.size}`, 'Content-Length': String(end - start + 1) },
      });
    }
    return new Response(Readable.toWeb(createReadStream(full)), { headers: { ...headers, 'Content-Length': String(stats.size) } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
