import { getShareSettings, isConfigured, objectUrl, type ShareSettings } from './settings';
import { signRequest } from './sigv4';

export type TransferResult =
  | { ok: true; body: string }
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
  return send('PUT', settings, id, body);
}

export async function getShared(id: string): Promise<TransferResult> {
  const settings = await getShareSettings();
  if (!isConfigured(settings)) return { ok: false, reason: 'not-configured' };
  return send('GET', settings, id, '');
}

async function send(
  method: 'PUT' | 'GET',
  settings: ShareSettings,
  id: string,
  body: string,
): Promise<TransferResult> {
  const url = objectUrl(settings, id);
  const { headers } = await signRequest({
    method,
    url,
    region: settings.region,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    body,
    headers: method === 'PUT' ? { 'content-type': 'application/json' } : {},
  });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: method === 'PUT' ? body : undefined,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 404 || response.status === 403) {
    // S3 answers 403 for a missing object when the caller cannot list the bucket.
    return { ok: false, reason: method === 'GET' ? 'not-found' : 'rejected' };
  }
  if (!response.ok) return { ok: false, reason: 'rejected' };
  return { ok: true, body: method === 'GET' ? await response.text() : '' };
}
