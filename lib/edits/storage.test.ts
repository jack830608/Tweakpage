import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { loadPageEdits, normalizePageUrl, pageKey, savePageEdits } from './storage';
import { emptyPageEdits, type PageEdits } from './types';

beforeEach(() => {
  fakeBrowser.reset();
});

test('normalizePageUrl keeps origin + pathname, drops query and hash', () => {
  expect(normalizePageUrl('https://positivegrid.com/products/spark?utm_source=x#hero')).toBe(
    'https://positivegrid.com/products/spark',
  );
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
  expect(await loadPageEdits('https://a.com/b?utm=1')).toEqual(page);
});

test('loading an unknown url returns null', async () => {
  expect(await loadPageEdits('https://a.com/unknown')).toBeNull();
});

test('saving with zero records removes the key', async () => {
  const page = emptyPageEdits('https://a.com/b', 'Title', '2026-08-15T10:00:00.000Z');
  await savePageEdits({ ...page, records: [] });
  expect(await loadPageEdits('https://a.com/b')).toBeNull();
});
