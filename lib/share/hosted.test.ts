import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { forget, hostedKey, remember, rememberedUrl } from './hosted';

beforeEach(() => fakeBrowser.reset());

test('the same picture in a different bucket is a different object', () => {
  expect(hostedKey('abc', 'one', false)).not.toBe(hostedKey('abc', 'two', false));
});

test('compressed and original are remembered apart', () => {
  // Turning compression on must not hand back the uncompressed URL.
  expect(hostedKey('abc', 'b', true)).not.toBe(hostedKey('abc', 'b', false));
});

test('what was remembered comes back; what was not is null', async () => {
  await remember('k1', 'https://host/a.png');
  expect(await rememberedUrl('k1')).toBe('https://host/a.png');
  expect(await rememberedUrl('k2')).toBeNull();
});

test('forgetting is how a deleted object stops being trusted', async () => {
  await remember('k1', 'https://host/a.png');
  await forget('k1');
  expect(await rememberedUrl('k1')).toBeNull();
});

test('the record cannot grow forever', async () => {
  for (let i = 0; i < 320; i++) await remember(`k${i}`, `https://host/${i}.png`);
  const stored = (await fakeBrowser.storage.local.get('tweakpage:hosted-images'))['tweakpage:hosted-images'];
  expect(Object.keys(stored as object).length).toBeLessThanOrEqual(300);
  expect(await rememberedUrl('k319'), 'the newest survives').toBe('https://host/319.png');
});

test('a broken store costs a re-upload, not an error', async () => {
  await fakeBrowser.storage.local.set({ 'tweakpage:hosted-images': 'not an object' });
  expect(await rememberedUrl('k1')).toBeNull();
  await expect(remember('k1', 'https://host/a.png')).resolves.toBeUndefined();
});
