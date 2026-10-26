// Photo sizes (client-safe). Uploaded photos are kept at full size (up to
// 1600 px) for the zoom viewer, but most places show them small: a card
// is ~180 px wide on a phone. Asking for the right size saves most of the
// data — a card thumbnail is ~25 KB instead of ~170 KB — which matters on
// Haitian prepaid mobile data.
//
// /uploads/<file>?w=<width> is resized once on the server (sharp), cached
// on disk, and served as WebP (or JPEG with f=jpg, for link previews).
// Only our own uploaded photos are resized; anything else is left alone.
export const PHOTO_WIDTHS = [320, 480, 800, 1200];

const RESIZABLE = /^\/uploads\/[\w.-]+\.(jpe?g|png|webp|avif)$/i;

export function photoSrc(src, width, format) {
  if (typeof src !== 'string' || !RESIZABLE.test(src)) return src;
  const w = PHOTO_WIDTHS.includes(width) ? width : 480;
  return `${src}?w=${w}${format === 'jpg' ? '&f=jpg' : ''}`;
}
