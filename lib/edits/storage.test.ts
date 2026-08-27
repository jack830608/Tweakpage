import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test } from 'vitest';
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

test('a content query is part of the page, and this is what that costs', () => {
  // Reversed deliberately, and the cost is written down here rather than discovered.
  //
  // The rule used to drop the query whole so that a shop adding ?variant= when you pick
  // a size did not appear to take your edits away. It also made youtube.com/watch?v=A
  // and ?v=B one page, so the words from one showed up on the other — silently, and
  // onward in the export. No strip-list knows every parameter, so the question is only
  // which way to be wrong, and putting one page's edits on another's content is worse
  // than filing a shop variant separately.
  const product = 'https://shop.example.com/products/spark-pedal';
  expect(normalizePageUrl(`${product}?variant=42`)).not.toBe(normalizePageUrl(product));
  expect(
    normalizePageUrl(`${product}?variant=42`),
    'and going back to that variant is how you find that work again',
  ).toBe(normalizePageUrl(`${product}?variant=42&utm_source=newsletter`));
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
  expect(pageKey('https://a.com/b?q=1')).toBe('page:https://a.com/b?q=1');
  expect(pageKey('https://a.com/b?utm_source=x')).toBe('page:https://a.com/b');
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

describe('a stored value we did not write', () => {
  const key = () => pageKey('https://a.com/p');

  test('never reaches the applier, whatever shape it is', async () => {
    // Taken on faith, each of these threw on first use — and the throw was swallowed, so
    // every saved edit on that page stopped replaying forever with no message anywhere.
    for (const junk of [
      'a string',
      42,
      [],
      null,
      { version: 1, url: 'https://a.com/p', records: 'not an array' },
      { version: 1, url: 'https://a.com/p', records: [null, undefined] },
      { version: 1, url: 'https://a.com/p' },
      { version: 9, url: 'https://a.com/p', records: [] },
    ]) {
      await fakeBrowser.storage.local.set({ [key()]: junk });
      const loaded = await loadPageEdits('https://a.com/p');
      expect(Array.isArray(loaded?.records ?? []), JSON.stringify(junk)).toBe(true);
      // Whatever came back must be usable without throwing.
      expect(() => (loaded?.records ?? []).map((r) => r.enabled)).not.toThrow();
    }
  });

  test('and a good one still comes back whole', async () => {
    const page = {
      version: 1 as const,
      url: 'https://a.com/p',
      title: 'T',
      updatedAt: 'n',
      records: [
        {
          id: 'r1', selector: '.t', fallbackSelectors: [], elementLabel: 'p',
          type: 'text' as const, property: 'textContent', oldValue: 'a', newValue: 'b',
          enabled: true, createdAt: 'n', updatedAt: 'n',
        },
      ],
    };
    await savePageEdits(page);
    expect((await loadPageEdits('https://a.com/p'))?.records).toHaveLength(1);
  });
});
