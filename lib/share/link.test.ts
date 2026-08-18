import { expect, test } from 'vitest';
import { decodeRef, imageUrl, makeShareId, objectUrl, shareLink, shareRefFrom } from './link';

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
    'https://my-bucket.s3.ap-northeast-1.amazonaws.com/tweakpage/shares/abcdefghijklmnopqrstuv.json',
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

test('the bucket is laid out by what each object is', () => {
  const ref = { id: 'a'.repeat(22), bucket: 'my-bucket', region: 'us-east-1' };
  expect(objectUrl(ref).pathname).toBe(`/tweakpage/shares/${ref.id}.json`);
  expect(imageUrl('my-bucket', 'us-east-1', 'abc.png').pathname).toBe('/tweakpage/images/abc.png');
  // Both under one prefix, so the policy in the setup instructions still covers everything.
  for (const url of [objectUrl(ref), imageUrl('my-bucket', 'us-east-1', 'abc.png')]) {
    expect(url.pathname.startsWith('/tweakpage/')).toBe(true);
  }
});
