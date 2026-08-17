import { objectUrl, type ShareRef } from './link';
import { getShareSettings, isConfigured, type ShareSettings } from './settings';
import { signRequest } from './sigv4';

export type TransferFailure =
  | 'not-configured'
  | 'not-found'
  | 'rejected'
  | 'not-readable'
  | 'offline';

export type TransferResult =
  | { ok: true; body: string; ref?: ShareRef }
  | { ok: false; reason: TransferFailure };

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
export async function putShared(id: string, body: string): Promise<TransferResult> {
  const settings = await getShareSettings();
  if (!isConfigured(settings)) return { ok: false, reason: 'not-configured' };

  const ref = { id, bucket: settings.bucket, region: settings.region };
  const written = await upload(settings, ref, body);
  if (!written.ok) return written;
  if (await isPubliclyReadable(ref)) return { ok: true, body: '', ref };

  const retried = await upload(settings, ref, body, 'public-read');
  if (!retried.ok) return { ok: false, reason: 'not-readable' };
  return (await isPubliclyReadable(ref))
    ? { ok: true, body: '', ref }
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
    const response = await fetch(objectUrl(ref).toString());
    if (response.status === 403 || response.status === 404) {
      return { ok: false, reason: 'not-found' };
    }
    if (!response.ok) return { ok: false, reason: 'rejected' };
    return { ok: true, body: await response.text() };
  } catch {
    return { ok: false, reason: 'offline' };
  }
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
    const response = await fetch(url.toString(), { method: 'PUT', headers, body });
    return response.ok ? { ok: true, body: '', ref } : { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/** Asks the way a stranger would: no credentials, no signature. */
async function isPubliclyReadable(ref: ShareRef): Promise<boolean> {
  try {
    const response = await fetch(objectUrl(ref).toString(), { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
