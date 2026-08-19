import { fetchWithin } from '../net';

/**
 * Optional image compression on the way to the bucket, via tinify.com.
 *
 * Strictly best-effort: a share must never fail because a third-party service is having
 * a bad day or the month's free quota ran out. Every failure path returns the original
 * bytes, and the caller reports what actually happened.
 */
export interface CompressResult {
  bytes: Uint8Array;
  /** False when the original is being returned — quota, an error, or an unsupported type. */
  compressed: boolean;
  /** How many compressions the key has used this month, when tinify tells us. */
  used?: number;
}

const ENDPOINT = 'https://api.tinify.com/shrink';
/** tinify only handles these; anything else goes up as it came in. */
const SUPPORTED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function compressImage(
  bytes: Uint8Array,
  mediaType: string,
  apiKey: string,
): Promise<CompressResult> {
  if (apiKey === '' || !SUPPORTED.has(mediaType)) return { bytes, compressed: false };
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        // tinify authenticates with HTTP Basic, the user name being the literal "api".
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
        'content-type': mediaType,
      },
      body: bytes as unknown as BodyInit,
    });
    const used = Number(response.headers.get('Compression-Count'));
    if (!response.ok) return { bytes, compressed: false, ...(used ? { used } : {}) };
    const location = (await response.json())?.output?.url;
    if (typeof location !== 'string') return { bytes, compressed: false };
    const compressed = await fetch(location);
    if (!compressed.ok) return { bytes, compressed: false };
    const shrunk = new Uint8Array(await compressed.arrayBuffer());
    // Compression that makes a file bigger is not compression.
    if (shrunk.length >= bytes.length) return { bytes, compressed: false, ...(used ? { used } : {}) };
    return { bytes: shrunk, compressed: true, ...(used ? { used } : {}) };
  } catch {
    return { bytes, compressed: false };
  }
}
