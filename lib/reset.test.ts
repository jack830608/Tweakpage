import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetTo, takeInventory } from './reset';
import { getExclusions, saveExclusions } from './exclusions';
import { getShareSettings } from './share/settings';

const FULL = {
  'tweakpage:panel-prefs': { width: 480, theme: 'dark' },
  'tweakpage:panel-position': { x: 10, y: 10 },
  'tweakpage:recent-colors': ['#ff0000'],
  'tweakpage:transfer-consent': ['my-bucket'],
  'tweakpage:hosted-images': { k: { url: 'https://h/a.png', compressed: false } },
  'tweakpage:onboarded': true,
  'tweakpage:exclusions': ['.chat-widget'],
  'tweakpage:share-settings': {
    bucket: 'my-bucket',
    region: 'us-east-1',
    accessKeyId: 'AKIA_SENTINEL',
    secretAccessKey: 'SECRET_SENTINEL',
    tinypngKey: 'TINIFY_SENTINEL',
    uploadImages: { summary: false, json: false, download: false, share: false },
    compressImages: true,
  },
  'page:https://a.com/one': { version: 1, url: 'https://a.com/one', records: [{}, {}], variants: [{}] },
  'page:https://b.com/two': { version: 1, url: 'https://b.com/two', records: [{}] },
};

beforeEach(async () => {
  fakeBrowser.reset();
  await fakeBrowser.storage.local.set(FULL);
});

const stored = async () => (await fakeBrowser.storage.local.get(null)) as Record<string, unknown>;

describe('what the offer says before you take it', () => {
  test('counts the work, not the keys', async () => {
    // "Delete all your changes" means nothing until it says two sites and three
    // changes. The number is the warning.
    expect(await takeInventory()).toEqual({
      pages: 2,
      records: 3,
      variants: 1,
      hasCredentials: true,
    });
  });

  test('and says there are no credentials when there are none', async () => {
    await fakeBrowser.storage.local.remove('tweakpage:share-settings');
    expect((await takeInventory()).hasCredentials).toBe(false);
  });
});

describe('preferences on their own', () => {
  test('go back to how the extension shipped', async () => {
    await resetTo(['preferences']);
    const all = await stored();
    for (const key of ['tweakpage:panel-prefs', 'tweakpage:panel-position', 'tweakpage:recent-colors', 'tweakpage:transfer-consent', 'tweakpage:hosted-images', 'tweakpage:onboarded']) {
      expect(all[key], key).toBeUndefined();
    }
    // Shipped state, not an empty list: the attribute convention is a default, and a
    // reset that removed it would be a reset to somewhere new.
    expect(await getExclusions()).toEqual(['[data-tweakpage-ignore]']);
  });

  test('take the upload switches with them, and leave the keys alone', async () => {
    // The two live in one stored object. Resetting your preferences must not be a way
    // to lose an AWS key you would have to go and fetch again.
    await resetTo(['preferences']);
    const settings = await getShareSettings();
    expect(settings.accessKeyId, 'untouched').toBe('AKIA_SENTINEL');
    expect(settings.tinypngKey, 'untouched').toBe('TINIFY_SENTINEL');
    expect(settings.uploadImages).toEqual({ summary: true, json: true, download: true, share: true });
    expect(settings.compressImages).toBe(false);
  });

  test('and leave every page of work exactly where it was', async () => {
    await resetTo(['preferences']);
    expect((await takeInventory()).records).toBe(3);
  });
});

describe('the work', () => {
  test('goes only when it is asked for, and then all of it', async () => {
    await resetTo(['edits']);
    const inventory = await takeInventory();
    expect(inventory).toMatchObject({ pages: 0, records: 0, variants: 0 });
    const all = await stored();
    expect(all['tweakpage:panel-prefs'], 'preferences are not collateral').toBeTruthy();
    expect(all['tweakpage:share-settings'], 'nor are the keys').toBeTruthy();
  });
});

describe('the credentials', () => {
  test('go only when they are asked for', async () => {
    await resetTo(['credentials']);
    const settings = await getShareSettings();
    expect(settings.accessKeyId).toBe('');
    expect(settings.tinypngKey).toBe('');
    expect((await takeInventory()).records, 'the work stays').toBe(3);
    expect((await stored())['tweakpage:panel-prefs'], 'so do preferences').toBeTruthy();
  });

  test('and asking for everything is one coherent outcome, not two fighting writes', async () => {
    await resetTo(['preferences', 'edits', 'credentials']);
    expect(await takeInventory()).toEqual({ pages: 0, records: 0, variants: 0, hasCredentials: false });
    const settings = await getShareSettings();
    expect(settings.uploadImages).toEqual({ summary: true, json: true, download: true, share: true });
    expect(await getExclusions()).toEqual(['[data-tweakpage-ignore]']);
  });
});

test('asking for nothing changes nothing', async () => {
  const before = await stored();
  await resetTo([]);
  expect(await stored()).toEqual(before);
});

test('a rule you added is gone, and the one that ships is back', async () => {
  await saveExclusions(['.a', '.b']);
  await resetTo(['preferences']);
  expect(await getExclusions()).toEqual(['[data-tweakpage-ignore]']);
});
