import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { hasConsented, recordConsent, withdrawConsent } from './consent';

beforeEach(() => fakeBrowser.reset());

test('nothing is agreed to until it is', async () => {
  expect(await hasConsented('my-bucket')).toBe(false);
});

test('agreeing is remembered', async () => {
  await recordConsent('my-bucket');
  expect(await hasConsented('my-bucket')).toBe(true);
});

test('agreeing to one bucket is not agreeing to another', async () => {
  // Changing the destination is a new decision: the first answer was about where the
  // pictures were going, not about uploading in the abstract.
  await recordConsent('my-bucket');
  expect(await hasConsented('someone-elses-bucket')).toBe(false);
});

test('a decision can be taken back', async () => {
  await recordConsent('my-bucket');
  await withdrawConsent();
  expect(await hasConsented('my-bucket')).toBe(false);
});

test('a broken store asks again rather than assuming yes', async () => {
  await fakeBrowser.storage.local.set({ 'tweakpage:transfer-consent': 'not an array' });
  expect(await hasConsented('my-bucket')).toBe(false);
});
