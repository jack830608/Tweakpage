import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { putShared } from './transfer';
import type { PageEdits } from '../edits/types';

/** putShared serialises the page itself now, so tests hand it one. */
function pageWith(title: string): PageEdits {
  return { version: 1, url: 'https://a.com/p', title, updatedAt: 'n', records: [] };
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
