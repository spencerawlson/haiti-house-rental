// Removing an uploaded file also removes the resized copies made from it
// (uploads/.thumbs/<name>-<width>.webp|jpg, see app/uploads/[file]). Best
// effort: a failed unlink leaves an unreferenced file, which is harmless.
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { PHOTO_WIDTHS } from './photo-url';

const DIR = () => path.join(process.cwd(), 'public', 'uploads');

export async function removeUpload(url) {
  const file = path.basename(String(url || ''));
  if (!file || file.startsWith('.')) return;
  await unlink(path.join(DIR(), file)).catch(() => {});
  const name = path.parse(file).name;
  for (const w of PHOTO_WIDTHS) {
    for (const ext of ['webp', 'jpg']) {
      await unlink(path.join(DIR(), '.thumbs', `${name}-${w}.${ext}`)).catch(() => {});
    }
  }
}
