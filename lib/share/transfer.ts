import { objectUrl, type ShareRef } from './link';
import { getShareSettings, isConfigured } from './settings';
import { signRequest } from './sigv4';

export type TransferResult =
  | { ok: true; body: string; ref?: ShareRef }
  | { ok: false; reason: 'not-configured' | 'not-found' | 'rejected' | 'offline' };

/**
 * Uploads and downloads run in the background service worker.
 *
 * A content script's fetch carries the page's origin, so the bucket would have to accept
 * every site anyone edits. From the worker the origin is the extension itself, which is
 * one entry in the bucket's CORS rules.
 */
export async function putShared(id: string, body: string): Promise<TransferResult> {
  const settings = await getShareSettings();
  if (!isConfigured(settings)) return { ok: false, reason: 'not-configured' };

  const ref = { id, bucket: settings.bucket, region: settings.region };
  const url = objectUrl(ref);
  const { headers } = await signRequest({
    method: 'PUT',
    url,
    region: settings.region,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    body,
    headers: { 'content-type': 'application/json' },
  });

  try {
    const response = await fetch(url.toString(), { method: 'PUT', headers, body });
    return response.ok ? { ok: true, body: '', ref } : { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/**
 * Reading needs nothing configured.
 *
 * The point of a link is that the person you send it to can open it — asking them to set
 * up AWS first would defeat it. The objects are world-readable under an unguessable name,
 * so the link itself is the permission.
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
