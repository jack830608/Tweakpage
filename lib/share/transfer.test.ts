import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { hostImages, putShared } from './transfer';
import type { PageEdits } from '../edits/types';

/** putShared serialises the page itself now, so tests hand it one — with an edit in
 * it, because a share of nothing is refused before any of this runs. */
function pageWith(title: string): PageEdits {
  return {
    version: 1, url: 'https://a.com/p', title, updatedAt: 'n',
    records: [{
      id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
      type: 'text', property: 'textContent', oldValue: 'Old', newValue: 'New',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    }],
  };
}

const SETTINGS = {
  bucket: 'demo',
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  tinypngKey: '',
  uploadImages: true,
  compressImages: false,
};

interface Call {
  method: string;
  acl: string | null;
}

/** Stands in for a bucket with a given attitude to public reads. */
function bucket({ publicByPolicy = false, aclAllowed = true }) {
  const calls: Call[] = [];
  let objectIsPublic = publicByPolicy;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const acl = ((init.headers ?? {}) as Record<string, string>)['x-amz-acl'] ?? null;
    calls.push({ method, acl });
    if (method === 'PUT') {
      if (acl && !aclAllowed) return new Response('', { status: 400 });
      if (acl) objectIsPublic = true;
      return new Response('', { status: 200 });
    }
    return new Response('', { status: objectIsPublic ? 200 : 403 });
  });
  return calls;
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
  await fakeBrowser.storage.local.set({ 'tweakpage:share-settings': SETTINGS });
});

test('a bucket that already serves public reads is uploaded to once', async () => {
  const calls = bucket({ publicByPolicy: true });
  const result = await putShared('abcdefghijklmnopqrstuv', pageWith('{}'));

  expect(result.ok).toBe(true);
  expect(calls.filter((c) => c.method === 'PUT'), 'no ACL needed, no second write').toHaveLength(1);
  expect(calls[0].acl, 'a bucket-owner-enforced bucket rejects this header').toBeNull();
});

test('a private bucket gets a second upload that asks to be readable', async () => {
  const calls = bucket({ publicByPolicy: false, aclAllowed: true });
  const result = await putShared('abcdefghijklmnopqrstuv', pageWith('{}'));

  expect(result.ok).toBe(true);
  const puts = calls.filter((c) => c.method === 'PUT');
  expect(puts).toHaveLength(2);
  expect(puts[1].acl).toBe('public-read');
});

test('a link nobody could open is reported instead of copied', async () => {
  bucket({ publicByPolicy: false, aclAllowed: false });
  const result = await putShared('abcdefghijklmnopqrstuv', pageWith('{}'));

  // The sender never finds out otherwise: the upload succeeds and only the recipient
  // sees the 403.
  expect(result).toEqual({ ok: false, reason: 'not-readable' });
});

test('the check is made the way a stranger would make it', async () => {
  const calls = bucket({ publicByPolicy: true });
  await putShared('abcdefghijklmnopqrstuv', pageWith('{}'));
  const head = calls.find((c) => c.method === 'HEAD');
  expect(head, 'unsigned, so it proves what an anonymous reader gets').toBeTruthy();
});

test('a share with nothing in it is refused before it reaches S3', async () => {
  const calls = bucket({ publicByPolicy: true });
  await fakeBrowser.storage.local.set({ 'tweakpage:share-settings': SETTINGS });
  const empty: PageEdits = { version: 1, url: 'https://a.com/p', title: 'T', updatedAt: 'n', records: [] };

  const result = await putShared('a'.repeat(22), empty);
  expect(result, 'the recipient is written to reject this; do not hand it over').toEqual({
    ok: false, reason: 'empty',
  });
  expect(calls, 'and nothing was uploaded').toHaveLength(0);
});

test('a share of only switched-off edits is empty too', async () => {
  bucket({ publicByPolicy: true });
  await fakeBrowser.storage.local.set({ 'tweakpage:share-settings': SETTINGS });
  const page = pageWith('T');
  const result = await putShared('a'.repeat(22), {
    ...page,
    records: page.records.map((r) => ({ ...r, enabled: false })),
  });
  expect(result.ok).toBe(false);
});

test('a cached image that TinyPNG refused keeps saying it was not compressed', async () => {
  // Reported as F-05: the second share read "compressed" off the request's intent.
  let tinifyCalls = 0;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    if (String(url).includes('tinify')) {
      tinifyCalls++;
      return new Response('', { status: 429 }); // out of quota
    }
    return new Response('', { status: 200 });
  });
  await fakeBrowser.storage.local.set({
    'tweakpage:share-settings': { ...SETTINGS, tinypngKey: 'k', compressImages: true },
    // Uploading is gated on consent; this test is about what happens after it.
    'tweakpage:transfer-consent': [SETTINGS.bucket],
  });
  const page: PageEdits = {
    ...pageWith('T'),
    records: [{
      id: 'i1', selector: 'img', fallbackSelectors: [], elementLabel: 'img',
      type: 'attr', property: 'src', oldValue: '/a.png',
      newValue: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    }],
  };
  const first = await hostImages(page, 'share');
  const second = await hostImages(page, 'share');
  expect(first.report.compressed, 'the quota was gone; nothing was compressed').toBe(0);
  expect(second.report.compressed, 'and the cache must not invent it').toBe(0);
  expect(tinifyCalls, 'nor pay for it twice').toBe(1);
});

test('nothing is uploaded until this bucket has been agreed to', async () => {
  const calls = bucket({ publicByPolicy: true });
  await fakeBrowser.storage.local.set({ 'tweakpage:share-settings': SETTINGS });
  const page: PageEdits = {
    ...pageWith('T'),
    records: [{
      id: 'i1', selector: 'img', fallbackSelectors: [], elementLabel: 'img',
      type: 'attr', property: 'src', oldValue: '/a.png',
      newValue: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    }],
  };

  const before = await hostImages(page, 'share');
  expect(before.report.needsConsent, 'the panel has a question to ask first').toBe(true);
  expect(before.report.uploaded).toBe(0);
  expect(calls.filter((c) => c.method === 'PUT'), 'and nothing left the machine').toHaveLength(0);

  await fakeBrowser.storage.local.set({ 'tweakpage:transfer-consent': [SETTINGS.bucket] });
  const after = await hostImages(page, 'share');
  expect(after.report.uploaded, 'once agreed, it goes').toBe(1);
});

test('agreeing to one bucket does not open another', async () => {
  bucket({ publicByPolicy: true });
  await fakeBrowser.storage.local.set({
    'tweakpage:share-settings': { ...SETTINGS, bucket: 'a-different-bucket' },
    'tweakpage:transfer-consent': ['demo'],
  });
  const page: PageEdits = {
    ...pageWith('T'),
    records: [{
      id: 'i1', selector: 'img', fallbackSelectors: [], elementLabel: 'img',
      type: 'attr', property: 'src', oldValue: '/a.png',
      newValue: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    }],
  };
  expect((await hostImages(page, 'share')).report.needsConsent).toBe(true);
});

test('a request that never answers gives up while somebody is still watching', async () => {
  // None of these calls had a deadline. A stalled upload spun its button for as long as
  // the network cared to keep the socket open, and when Chrome eventually killed the
  // worker the user was told to check credentials that were fine.
  const { fetchWithin } = await import('../net');
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        (init as RequestInit).signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
  );
  await expect(fetchWithin('https://example.com/', {}, 20)).rejects.toThrow();
  vi.restoreAllMocks();
});
