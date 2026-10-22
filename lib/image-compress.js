// Shrink photos in the browser before upload (Phase 3). Phone photos are
// often 4–10 MB; on Haitian mobile data that is slow to send and slow
// for every tenant who opens the listing. Images are scaled to at most
// 1600 px on the long side and re-encoded as JPEG (quality 0.82), which
// usually lands at 200–500 KB. GIFs (animation) and videos pass through.
// If the browser can decode a format the server does not accept (e.g.
// HEIC on iPhone Safari), this also converts it to JPEG.
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    // Already small enough and in a served format: keep the original.
    if (scale === 1 && file.size < 400 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNG areas become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file; // undecodable here: let the server decide
  }
}
