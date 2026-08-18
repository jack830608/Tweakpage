import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { loadPageEdits, normalizePageUrl, pageKey, savePageEdits } from './storage';
import { emptyPageEdits, type PageEdits } from './types';

beforeEach(() => {
  fakeBrowser.reset();
});

test('normalizePageUrl keeps origin and path, drops the query and the fragment', () => {
  expect(normalizePageUrl('https://example.com/products/spark?utm_source=x#hero')).toBe(
    'https://example.com/products/spark',
  );
});

test('a query that does not change which page you are on does not lose your work', () => {
  // The regression this rule exists for: a shop adds ?variant= when you pick a size, and
  // the edits you just made vanish. Session ids, page numbers and campaign tags all do
  // the same thing, and no strip-list can know them all.
  const product = 'https://shop.example.com/products/spark-pedal';
  expect(normalizePageUrl(`${product}?variant=42`)).toBe(normalizePageUrl(product));
  expect(normalizePageUrl(`${product}?variant=99&sid=abc`)).toBe(normalizePageUrl(product));
  expect(normalizePageUrl('https://a.com/blog?page=2')).toBe(normalizePageUrl('https://a.com/blog'));
});

test('a share link opens the same page it points at', () => {
  // The recipient arrives with ?tweakpage=<ref>; Keep must save where the clean URL loads.
  expect(normalizePageUrl('https://a.com/p?tweakpage=abc_bucket_region')).toBe(
    normalizePageUrl('https://a.com/p'),
  );
});

test('a hash route is still its own page', () => {
  expect(normalizePageUrl('https://a.com/app#/products/2')).not.toBe(
    normalizePageUrl('https://a.com/app#/products/3'),
  );
  expect(normalizePageUrl('https://a.com/app#features')).toBe(normalizePageUrl('https://a.com/app'));
});

test('pageKey prefixes with page:', () => {
  expect(pageKey('https://a.com/b?q=1')).toBe('page:https://a.com/b');
});

test('save and load round-trip', async () => {
  const page: PageEdits = {
    ...emptyPageEdits('https://a.com/b', 'Title', '2026-08-15T10:00:00.000Z'),
    records: [
      {
        id: 'r1', selector: '.x', fallbackSelectors: [], elementLabel: 'p.x',
        type: 'style', property: 'color', oldValue: '#000000', newValue: '#ff0000',
        enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
      },
    ],
  };
  await savePageEdits(page);
  expect(await loadPageEdits('https://a.com/b?utm_source=1')).toEqual(page);
});

test('loading an unknown url returns null', async () => {
  expect(await loadPageEdits('https://a.com/unknown')).toBeNull();
});

test('saving with zero records removes the key', async () => {
  const page = emptyPageEdits('https://a.com/b', 'Title', '2026-08-15T10:00:00.000Z');
  await savePageEdits({ ...page, records: [] });
  expect(await loadPageEdits('https://a.com/b')).toBeNull();
});
