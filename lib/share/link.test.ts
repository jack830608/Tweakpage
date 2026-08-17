import { expect, test } from 'vitest';
import { decodeRef, makeShareId, objectUrl, shareLink, shareRefFrom } from './link';

const REF = { id: 'abcdefghijklmnopqrstuv', bucket: 'my-bucket', region: 'ap-northeast-1' };

test('ids are long and unguessable', () => {
  const ids = new Set(Array.from({ length: 200 }, () => makeShareId()));
  expect(ids.size, 'no collisions in 200 draws').toBe(200);
});

test('a link is the page itself, with the reference added', () => {
  const link = shareLink('https://example.com/pricing?utm=x#hero', REF);
  // Readable rather than percent-encoded, so the link survives being pasted anywhere.
  expect(link).toContain('tweakpage=abcdefghijklmnopqrstuv_my-bucket_ap-northeast-1');
  expect(shareRefFrom(link)).toEqual(REF);
});

test('the address is built from the parts, never taken from the link', () => {
  expect(objectUrl(REF).toString()).toBe(
    'https://my-bucket.s3.ap-northeast-1.amazonaws.com/tweakpage/abcdefghijklmnopqrstuv.json',
  );
});

test('a reference that could point somewhere else is refused', () => {
  // Each part has to look like what it claims to be before any request is built from it.
  expect(decodeRef('abcdefghijklmnopqrstuv_evil.example.com/x_ap-northeast-1')).toBeNull();
  expect(decodeRef('abcdefghijklmnopqrstuv_my-bucket_../../etc')).toBeNull();
  expect(decodeRef('abcdefghijklmnopqrstuv_my-bucket_ap-northeast-1_extra')).toBeNull();
  expect(decodeRef('SHORT_my-bucket_ap-northeast-1')).toBeNull();
  expect(shareRefFrom('https://example.com/?tweakpage=https://evil.example/x.json')).toBeNull();
  expect(shareRefFrom('https://example.com/')).toBeNull();
});
