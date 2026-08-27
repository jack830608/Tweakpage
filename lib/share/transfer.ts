import { compressImage } from './compress';
import { hasConsented } from './consent';
import { forget, hostedKey, remember, remembered } from './hosted';
import { embeddedImages, imageKey, withHostedImages, type EmbeddedImage } from './images';
import { imageUrl, objectUrl, type ShareRef } from './link';
import { MAX_SHARE_BYTES } from '../edits/import';
import type { PageEdits } from '../edits/types';
import { getShareSettings, isConfigured, type HandOff, type ShareSettings } from './settings';
import { signRequest } from './sigv4';
import { fetchWithin } from '../net';
import { stamped } from '../version';
import { forHandOff } from '../export/hand-off';

export type TransferFailure =
  | 'not-configured'
  | 'not-found'
  | 'rejected'
  | 'not-readable'
  | 'too-large'
  | 'empty'
  | 'offline';

export type TransferResult =
  | { ok: true; body: string; ref?: ShareRef; images?: ImageReport; page?: PageEdits }
  | { ok: false; reason: TransferFailure };

/** What happened to the page's embedded images on the way up. */
export interface ImageReport {
  uploaded: number;
  compressed: number;
  /** Images that had to travel embedded — no bucket, no consent, or a refused upload. */
  embedded: number;
  /** Nothing was uploaded because this bucket has not been agreed to yet. */
  needsConsent?: boolean;
}

/**
 * Lifts embedded images out to the bucket and hands back a page that points at them.
 *
 * Best-effort by design: an image that will not upload stays embedded rather than
 * failing the share, and compression is skipped rather than blocking. What actually
 * happened is reported so the toast can say it instead of guessing.
 */
export async function hostImages(
  page: PageEdits,
  handOff: HandOff,
  { allowUpload = true }: { allowUpload?: boolean } = {},
): Promise<{
  page: PageEdits;
  report: ImageReport;
}> {
  const images = embeddedImages(page);
  if (images.length === 0) return { page, report: { uploaded: 0, compressed: 0, embedded: 0 } };
  const settings = await getShareSettings();
  if (!allowUpload || !settings.uploadImages[handOff] || !isConfigured(settings)) {
    return { page, report: { uploaded: 0, compressed: 0, embedded: images.length } };
  }
  // Checked here rather than at each button, so a hand-off cannot be added that quietly
  // skips it. The panel asks first, but this is what makes that unavoidable.
  if (!(await hasConsented(settings.bucket))) {
    return {
      page,
      report: { uploaded: 0, compressed: 0, embedded: images.length, needsConsent: true },
    };
  }

  const hosted = new Map<string, string>();
  let compressed = 0;
  for (const image of images) {
    const result = await hostOne(image, settings);
    if (!result) continue;
    hosted.set(image.dataUrl, result.url);
    if (result.compressed) compressed++;
  }
  return {
    page: withHostedImages(page, hosted),
    report: { uploaded: hosted.size, compressed, embedded: images.length - hosted.size },
  };
}

async function hostOne(
  image: EmbeddedImage,
  settings: ShareSettings,
): Promise<{ url: string; compressed: boolean } | null> {
  const compress = settings.compressImages && settings.tinypngKey !== '';
  const rememberedAs = hostedKey(await imageKey(image), settings.bucket, compress);

  // Already up there? Confirm it is still readable — buckets get emptied — and skip
  // both the upload and, with compression on, a slice of the month's quota.
  const known = await remembered(rememberedAs);
  if (known && (await isReadable(known.url))) return known;
  if (known) await forget(rememberedAs);

  const shrunk = compress
    ? await compressImage(image.bytes, image.mediaType, settings.tinypngKey)
    : { bytes: image.bytes, compressed: false };
  // Named after its own content, so the same picture lands on the same object however
  // often it is shared — and the name changes when compression changes the bytes.
  const key = await imageKey({ ...image, bytes: shrunk.bytes });
  const url = imageUrl(settings.bucket, settings.region, key);
  const written = await putBytes(settings, url, shrunk.bytes, image.mediaType);
  if (!written) return null;
  const hosted = { url: url.toString(), compressed: shrunk.compressed };
  await remember(rememberedAs, hosted);
  return hosted;
}

/** Asks the way a recipient would: no credentials. */
async function isReadable(url: string): Promise<boolean> {
  try {
    return (await fetchWithin(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

async function putBytes(
  settings: ShareSettings,
  url: URL,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  for (const acl of [undefined, 'public-read'] as const) {
    const { headers } = await signRequest({
      method: 'PUT',
      url,
      region: settings.region,
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
      body: bytes,
      headers: { 'content-type': contentType, ...(acl ? { 'x-amz-acl': acl } : {}) },
    });
    try {
      const response = await fetchWithin(url.toString(), { method: 'PUT', headers, body: bytes as unknown as BodyInit });
      if (!response.ok) continue;
      // The recipient reads it with no credentials, so that is how it gets checked.
      if ((await fetchWithin(url.toString(), { method: 'HEAD' })).ok) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Uploads, then checks that the link it produced can actually be opened.
 *
 * Handing someone a link that 403s is the worst outcome here, because the sender has no
 * way to know: the upload succeeded, the clipboard filled, and only the recipient finds
 * out. So the object is written, read back the way a stranger would read it, and only
 * then reported as shareable.
 *
 * Two bucket shapes are common. One grants public reads through a bucket policy, where
 * the plain upload is already readable. The other leaves ACLs enabled and nothing public,
 * where the object has to ask for it — so that is the second attempt rather than the
 * first, because a bucket-owner-enforced bucket rejects the ACL outright.
 */
export async function putShared(
  id: string,
  page: PageEdits,
  { allowUpload = true }: { allowUpload?: boolean } = {},
): Promise<TransferResult> {
  const settings = await getShareSettings();
  if (!isConfigured(settings)) return { ok: false, reason: 'not-configured' };
  // A share of nothing is a link the recipient is written to reject. Refused here as
  // well as in the UI: the button is where it is convenient to say so, not where it is
  // guaranteed.
  if (!page.records.some((r) => r.enabled)) return { ok: false, reason: 'empty' };

  // Images first: a page whose pictures are hosted is small enough to survive the import
  // limits on arrival, which embedded ones are not.
  const { page: hosted, report } = await hostImages(page, 'share', { allowUpload });
  // Stamped like the exports: a share is the hand-off most likely to be opened by a
  // different build than the one that wrote it.
  const body = JSON.stringify(stamped(forHandOff(hosted)));
  // What we refuse to send is what a recipient refuses to read; the two limits are one
  // constant so they cannot drift.
  if (body.length > MAX_SHARE_BYTES) return { ok: false, reason: 'too-large' };

  const ref = { id, bucket: settings.bucket, region: settings.region };
  const written = await upload(settings, ref, body);
  if (!written.ok) return written;
  // The rewritten page travels back so the editor can point its own records at the
  // images that now have addresses.
  if (await isPubliclyReadable(ref)) return { ok: true, body: '', ref, images: report, page: hosted };

  const retried = await upload(settings, ref, body, 'public-read');
  if (!retried.ok) return { ok: false, reason: 'not-readable' };
  return (await isPubliclyReadable(ref))
    ? { ok: true, body: '', ref, images: report, page: hosted }
    : { ok: false, reason: 'not-readable' };
}

/**
 * Reading needs nothing configured.
 *
 * The point of a link is that the person you send it to can open it — asking them to set
 * up AWS first would defeat it.
 */
export async function getShared(ref: ShareRef): Promise<TransferResult> {
  try {
    const response = await fetchWithin(objectUrl(ref).toString());
    if (response.status === 403 || response.status === 404) {
      return { ok: false, reason: 'not-found' };
    }
    if (!response.ok) return { ok: false, reason: 'rejected' };
    // Whoever controls the object controls its size. Reading it whole before looking is
    // how a link becomes a way to exhaust the tab.
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_SHARE_BYTES) {
      return { ok: false, reason: 'too-large' };
    }
    const body = await readBounded(response, MAX_SHARE_BYTES);
    if (body === null) return { ok: false, reason: 'too-large' };
    return { ok: true, body };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/** Reads a response, giving up the moment it grows past what we would ever accept. */
async function readBounded(response: Response, limit: number): Promise<string | null> {
  const reader = response.body?.getReader();
  // No streaming body (some test doubles, some environments): fall back to the header
  // check above plus a length check after the fact.
  if (!reader) {
    const text = await response.text();
    return text.length > limit ? null : text;
  }
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > limit) {
      await reader.cancel();
      return null;
    }
  }
  return text + decoder.decode();
}

async function upload(
  settings: ShareSettings,
  ref: ShareRef,
  body: string,
  acl?: 'public-read',
): Promise<TransferResult> {
  const url = objectUrl(ref);
  const { headers } = await signRequest({
    method: 'PUT',
    url,
    region: settings.region,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    body,
    headers: {
      'content-type': 'application/json',
      ...(acl ? { 'x-amz-acl': acl } : {}),
    },
  });
  try {
    const response = await fetchWithin(url.toString(), { method: 'PUT', headers, body });
    return response.ok ? { ok: true, body: '', ref } : { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/** Asks the way a stranger would: no credentials, no signature. */
async function isPubliclyReadable(ref: ShareRef): Promise<boolean> {
  try {
    const response = await fetchWithin(objectUrl(ref).toString(), { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
