import { expect, test } from 'vitest';
import { isShareId, makeShareId, shareIdFrom, shareLink } from './link';

test('ids are long and unguessable', () => {
  const ids = new Set(Array.from({ length: 200 }, () => makeShareId()));
  expect(ids.size, 'no collisions in 200 draws').toBe(200);
  for (const id of ids) expect(isShareId(id)).toBe(true);
});

test('a link is the page itself, with the id added', () => {
  const link = shareLink('https://example.com/pricing?utm=x#hero', 'abcdefghijklmnopqrstuv');
  expect(link).toBe('https://example.com/pricing?utm=x&tweakpage=abcdefghijklmnopqrstuv#hero');
  expect(shareIdFrom(link)).toBe('abcdefghijklmnopqrstuv');
});

test('anything that is not one of our ids is ignored', () => {
  // The id is looked up against the reader's own bucket, so a crafted value must not
  // become a lookup — and certainly not a URL to fetch.
  expect(shareIdFrom('https://example.com/?tweakpage=https://evil.example/x.json')).toBeNull();
  expect(shareIdFrom('https://example.com/?tweakpage=../../etc/passwd')).toBeNull();
  expect(shareIdFrom('https://example.com/?tweakpage=SHORT')).toBeNull();
  expect(shareIdFrom('https://example.com/')).toBeNull();
});
