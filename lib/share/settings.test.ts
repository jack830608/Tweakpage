import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { getShareSettings, isConfigured, EMPTY_SETTINGS, HAND_OFFS } from './settings';

beforeEach(() => fakeBrowser.reset());

const store = (value: unknown) =>
  fakeBrowser.storage.local.set({ 'tweakpage:share-settings': value });

test('every hand-off uploads by default', async () => {
  // With no bucket configured nothing uploads anyway, so "on" means "upload when there
  // is somewhere to upload to".
  const settings = await getShareSettings();
  expect(HAND_OFFS.map((k) => settings.uploadImages[k])).toEqual([true, true, true, true]);
});

test('what the share-only version stored still means what it meant', async () => {
  // The first version wrote a single boolean, when the choice was share-or-not.
  await store({ ...EMPTY_SETTINGS, uploadImages: false });
  const off = await getShareSettings();
  expect(HAND_OFFS.every((k) => off.uploadImages[k] === false), 'off stayed off').toBe(true);

  await store({ ...EMPTY_SETTINGS, uploadImages: true });
  const on = await getShareSettings();
  expect(HAND_OFFS.every((k) => on.uploadImages[k] === true)).toBe(true);
});

test('a partly-written record keeps the answers it has', async () => {
  await store({ ...EMPTY_SETTINGS, uploadImages: { json: false } });
  const settings = await getShareSettings();
  expect(settings.uploadImages.json, 'the stored answer').toBe(false);
  expect(settings.uploadImages.share, 'and the default for the rest').toBe(true);
});

test('nonsense in storage falls back rather than breaking sharing', async () => {
  await store({ ...EMPTY_SETTINGS, uploadImages: 'yes please' });
  expect((await getShareSettings()).uploadImages.share).toBe(true);
});

test('the preferences beside the credentials do not count as configuration', async () => {
  // uploadImages defaults to a truthy object; isConfigured must still be false until the
  // four AWS fields are filled, or the Share button would offer a link that cannot work.
  expect(isConfigured(await getShareSettings())).toBe(false);
});

test('compression stays off until it is asked for', async () => {
  // It sends images to a third party, which is never a default.
  expect((await getShareSettings()).compressImages).toBe(false);
});
