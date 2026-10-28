// Shared upload validation and storage. Extracted from
// app/api/upload/route.js (Phase 1b) when profile photos needed the same
// checks: the magic-byte test is the control that stops an HTML or script
// file being stored under an image name and served back, so there must be
// exactly ONE copy of it. Two copies drift, and the stale one becomes the
// hole.
//
// Allowed formats are exactly the ones app/uploads/[file]/route.js serves,
// so SVG (an XSS vector) can never be stored and handed to a browser.
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
export const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];
// Voice notes. .weba (not .webm) for audio-only WebM/Opus, so it never
// collides with the .webm video entry in app/uploads/[file]/route.js's
// Content-Type map — same container family, different extension.
export const AUDIO_EXTS = ['.weba', '.m4a'];

// The file's first bytes must match its extension, so an HTML/script file
// renamed to .jpg is refused.
export function matchesMagic(buf, ext) {
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
    case '.weba':
      return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    case '.m4a':
      return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(ascii(4, 8));
    default:
      return false;
  }
}

// The lowercased extension of an uploaded file, '' when it has none.
export function uploadExt(file) {
  return path.extname(file?.name || '').toLowerCase();
}

// Write the bytes under a name nobody can guess or collide with, and
// return the public /uploads/<name> path.
export async function saveUpload(buf, ext) {
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}
