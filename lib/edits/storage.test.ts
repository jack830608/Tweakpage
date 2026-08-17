import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { loadPageEdits, normalizePageUrl, pageKey, savePageEdits } from './storage';
import { emptyPageEdits, type PageEdits } from './types';

beforeEach(() => {
  fakeBrowser.reset();
});

test('normalizePageUrl drops tracking params and the fragment', () => {
  expect(normalizePageUrl('https://example.com/products/spark?utm_source=x#hero')).toBe(
    'https://example.com/products/spark',
  );
});

test('a query that selects content is part of the page identity', () => {
  // ?view=A and ?view=B serve different documents; treating them as one page applied
  // A's edits to B (review 2026-08-17, finding 2).
  expect(normalizePageUrl('https://a.com/?view=A')).not.toBe(normalizePageUrl('https://a.com/?view=B'));
  expect(normalizePageUrl('https://a.com/search?q=guitars')).toBe('https://a.com/search?q=guitars');
});

test('tracking params never split a page into buckets', () => {
  const clean = normalizePageUrl('https://a.com/p?view=A');
  expect(normalizePageUrl('https://a.com/p?view=A&utm_source=mail&utm_campaign=x')).toBe(clean);
  expect(normalizePageUrl('https://a.com/p?gclid=123&view=A&fbclid=456')).toBe(clean);
});

test('param order does not create a second bucket', () => {
  expect(normalizePageUrl('https://a.com/p?b=2&a=1')).toBe(normalizePageUrl('https://a.com/p?a=1&b=2'));
});

test('a share link opens the same bucket as the page it points at', () => {
  // The recipient arrives with ?tweakpage=<ref>; Keep must save where the clean URL loads.
  expect(normalizePageUrl('https://a.com/p?tweakpage=abc_bucket_region')).toBe(
    normalizePageUrl('https://a.com/p'),
  );
});

test('pageKey prefixes with page:', () => {
  expect(pageKey('https://a.com/b?q=1')).toBe('page:https://a.com/b?q=1');
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
