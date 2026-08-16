/** Chrome refuses to store much more than this per key, and the edit has to fit too. */
export const MAX_IMAGE_BYTES = 1_500_000;

export interface ImageFileResult {
  ok: true;
  dataUrl: string;
}
export interface ImageFileError {
  ok: false;
  reason: 'not-an-image' | 'too-large' | 'unreadable';
}

/**
 * Turns a picked file into a data: URL.
 *
 * The image people want to try is on their desktop, not on a CDN — asking for a URL
 * meant uploading it somewhere first, which is the whole friction this tool exists to
 * remove. The stored edit carries the bytes, so it replays on reload like any other.
 */
export async function readImageFile(file: File): Promise<ImageFileResult | ImageFileError> {
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'not-an-image' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: 'too-large' };
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('unreadable'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    if (!dataUrl.startsWith('data:image/')) return { ok: false, reason: 'not-an-image' };
    return { ok: true, dataUrl };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
