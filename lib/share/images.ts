import type { EditRecord, PageEdits } from '../edits/types';

/**
 * Local images, on their way to a colleague.
 *
 * A picked file is stored as a data: URL — right for this machine, useless in a share:
 * the bytes make the page JSON enormous, and the import limits reject a record that big,
 * so the recipient silently saw the original image. Sharing therefore lifts every
 * embedded image out to the bucket and sends a URL in its place.
 *
 * Only the uploaded copy is rewritten. The local record keeps its data: URL, so the page
 * still replays offline and does not break if the object is later deleted.
 */

/** Where a data: URL can legitimately appear in a record. */
const IMAGE_PROPERTIES = new Set(['src', 'srcset', 'backgroundImage']);
const DATA_IMAGE = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

export interface EmbeddedImage {
  dataUrl: string;
  mediaType: string;
  bytes: Uint8Array;
}

/** Every distinct embedded image in the page, in the order they appear. */
export function embeddedImages(page: PageEdits): EmbeddedImage[] {
  const seen = new Map<string, EmbeddedImage>();
  for (const record of page.records) {
    if (!IMAGE_PROPERTIES.has(record.property)) continue;
    for (const match of record.newValue.matchAll(DATA_IMAGE)) {
      const dataUrl = match[0];
      if (seen.has(dataUrl)) continue;
      const decoded = decodeDataUrl(dataUrl);
      if (decoded) seen.set(dataUrl, decoded);
    }
  }
  return [...seen.values()];
}

/** Rewrites the records against a map of data: URL → hosted URL. */
export function withHostedImages(page: PageEdits, hosted: Map<string, string>): PageEdits {
  if (hosted.size === 0) return page;
  const swap = (value: string) =>
    value.replace(DATA_IMAGE, (dataUrl) => hosted.get(dataUrl) ?? dataUrl);
  const rewrite = (record: EditRecord): EditRecord =>
    IMAGE_PROPERTIES.has(record.property)
      ? { ...record, newValue: swap(record.newValue), oldValue: swap(record.oldValue) }
      : record;
  return {
    ...page,
    records: page.records.map(rewrite),
    ...(page.variants
      ? { variants: page.variants.map((v) => ({ ...v, records: v.records.map(rewrite) })) }
      : {}),
  };
}

/** The object name an image gets: its own content, so the same picture uploads once. */
export async function imageKey(image: EmbeddedImage): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', image.bytes as unknown as ArrayBuffer);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex}.${extensionFor(image.mediaType)}`;
}

function extensionFor(mediaType: string): string {
  const subtype = mediaType.slice('image/'.length).toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  return /^[a-z0-9]{1,5}$/.test(subtype) ? subtype : 'bin';
}

function decodeDataUrl(dataUrl: string): EmbeddedImage | null {
  const comma = dataUrl.indexOf(',');
  const mediaType = dataUrl.slice('data:'.length, dataUrl.indexOf(';'));
  if (comma === -1 || !mediaType.startsWith('image/')) return null;
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { dataUrl, mediaType, bytes };
  } catch {
    return null;
  }
}
