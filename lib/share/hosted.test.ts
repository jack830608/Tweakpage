import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { forget, hostedKey, remember, remembered } from './hosted';

beforeEach(() => fakeBrowser.reset());

const KEY = 'tweakpage:hosted-images';

test('the same picture in a different bucket is a different object', () => {
  expect(hostedKey('abc', 'one', false)).not.toBe(hostedKey('abc', 'two', false));
});

test('compressed and original are remembered apart', () => {
  // Turning compression on must not hand back the uncompressed URL.
  expect(hostedKey('abc', 'b', true)).not.toBe(hostedKey('abc', 'b', false));
});

test('what was remembered comes back; what was not is null', async () => {
  await remember('k1', { url: 'https://host/a.png', compressed: true });
  expect(await remembered('k1')).toEqual({ url: 'https://host/a.png', compressed: true });
  expect(await remembered('k2')).toBeNull();
});

test('an upload that was not compressed never starts claiming it was', async () => {
  // TinyPNG refused (quota, error, unsupported), so the original went up. Every later
  // share of that image has to keep saying so — reading the answer back off the request
  // was how it began reporting a compression that never happened.
  await remember('k1', { url: 'https://host/a.png', compressed: false });
  expect((await remembered('k1'))?.compressed).toBe(false);
});

test('an entry written before outcomes were recorded is not assumed compressed', async () => {
  await fakeBrowser.storage.local.set({ [KEY]: { k1: 'https://host/a.png' } });
  expect(await remembered('k1'), 'a good address, and no claim about the bytes').toEqual({
    url: 'https://host/a.png',
    compressed: false,
  });
});

test('forgetting is how a deleted object stops being trusted', async () => {
  await remember('k1', { url: 'https://host/a.png', compressed: false });
  await forget('k1');
  expect(await remembered('k1')).toBeNull();
});

test('the record cannot grow forever', async () => {
  for (let i = 0; i < 320; i++) await remember(`k${i}`, { url: `https://host/${i}.png`, compressed: false });
  const stored = (await fakeBrowser.storage.local.get(KEY))[KEY];
  expect(Object.keys(stored as object).length).toBeLessThanOrEqual(300);
  expect((await remembered('k319'))?.url, 'the newest survives').toBe('https://host/319.png');
});

test('a broken store costs a re-upload, not an error', async () => {
  await fakeBrowser.storage.local.set({ [KEY]: 'not an object' });
  expect(await remembered('k1')).toBeNull();
  await expect(remember('k1', { url: 'https://host/a.png', compressed: false })).resolves.toBeUndefined();
});
