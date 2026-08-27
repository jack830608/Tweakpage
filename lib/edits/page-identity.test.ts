import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { loadPageEdits, normalizePageUrl, savePageEdits } from './storage';
import { emptyPageEdits, type EditRecord } from './types';

beforeEach(() => fakeBrowser.reset());

const record = (): EditRecord => ({
  id: 'r1', selector: '.hero', fallbackSelectors: [], elementLabel: 'h1.hero',
  type: 'text', property: 'textContent', oldValue: 'A', newValue: 'B',
  enabled: true, createdAt: 'n', updatedAt: 'n',
});

/**
 * The failure this exists to end. The query is what names the content on a great many
 * sites, so dropping it filed two different videos under one page and showed the edits
 * from one on the other — silently, and onward in the hand-off.
 */
test('a query that names the content separates two pages', () => {
  expect(normalizePageUrl('https://youtube.com/watch?v=AAA'))
    .not.toBe(normalizePageUrl('https://youtube.com/watch?v=BBB'));
});

test('a query that only says how you arrived does not', () => {
  const bare = normalizePageUrl('https://example.com/post');
  for (const noise of ['utm_source=twitter&utm_campaign=x', 'fbclid=abc', 'gclid=abc', '_ga=1.2.3']) {
    expect(normalizePageUrl(`https://example.com/post?${noise}`), noise).toBe(bare);
  }
});

test('the same page reached two ways is one page', () => {
  expect(normalizePageUrl('https://example.com/p?b=2&a=1'))
    .toBe(normalizePageUrl('https://example.com/p?a=1&b=2'));
});

test('content parameters survive alongside arrival ones', () => {
  expect(normalizePageUrl('https://example.com/search?q=amps&utm_source=x'))
    .toBe('https://example.com/search?q=amps');
});

/**
 * Anything doubtful stays. Wrong in this direction costs a page two sets of edits
 * instead of one; wrong the other way puts one page's words on another's content.
 */
test('a parameter that might mean something is kept', () => {
  for (const maybe of ['ref=nav', 'source=email', 'id=7', 'variant=42']) {
    expect(normalizePageUrl(`https://example.com/p?${maybe}`), maybe).toContain(maybe);
  }
});

test('a hash route is still its own page, query or not', () => {
  expect(normalizePageUrl('https://app.example.com/?q=1#/products/2'))
    .toBe('https://app.example.com/?q=1#/products/2');
  expect(normalizePageUrl('https://example.com/p#features')).toBe('https://example.com/p');
});

test('edits round-trip on a query-identified page and stay off its neighbours', async () => {
  const url = 'https://youtube.com/watch?v=AAA';
  await savePageEdits({ ...emptyPageEdits(normalizePageUrl(url), 'T', 'n'), records: [record()] });
  expect((await loadPageEdits(url))?.records).toHaveLength(1);
  expect(await loadPageEdits('https://youtube.com/watch?v=BBB')).toBeNull();
});
