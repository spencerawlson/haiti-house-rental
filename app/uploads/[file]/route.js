import { readFile } from 'fs/promises';
import path from 'path';

// Serves uploaded house photos/videos from disk. Next's static handler
// does not serve files added to public/uploads at runtime in the
// standalone server (uploads returned success but their URLs 404'd on
// live) — so this route reads the same directory the upload route writes
// to and streams the file. Old /uploads/<name> URLs keep working, so
// photos uploaded before this route existed display without re-uploading.
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
};

export async function GET(request, { params }) {
  const file = path.basename(params.file || '');
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!file || file.startsWith('.') || !type) {
    return new Response('Not found', { status: 404 });
  }
  const full = path.join(process.cwd(), 'public', 'uploads', file);
  try {
    const buf = await readFile(full);
    return new Response(buf, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
