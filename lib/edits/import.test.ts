import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import { importPageEdits, mergeRecords, parseImport } from './import';
import { loadPageEdits, savePageEdits } from './storage';
import { emptyPageEdits, type EditRecord } from './types';

beforeEach(() => {
  fakeBrowser.reset();
});

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1', selector: '.hero', fallbackSelectors: [], elementLabel: 'h2.hero',
    type: 'style', property: 'color', oldValue: '#333333', newValue: '#ff0000',
    enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

function exportJson(records: EditRecord[]): string {
  return JSON.stringify({
    version: 1, url: 'https://example.com/page', title: 'T',
    records, updatedAt: '2026-08-15T10:00:00.000Z',
  });
}

test('parses a valid export', () => {
  const result = parseImport(exportJson([record({})]));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.page.records).toHaveLength(1);
    expect(result.skipped).toBe(0);
  }
});

test('rejects invalid json, wrong version, and bad urls', () => {
  expect(parseImport('not json').ok).toBe(false);
  expect(parseImport(JSON.stringify({ version: 2, url: 'https://a.com/', records: [] })).ok).toBe(false);
  expect(parseImport(JSON.stringify({ version: 1, url: 'javascript:alert(1)', records: [] })).ok).toBe(false);
  expect(parseImport(JSON.stringify({ version: 1, url: 'https://a.com/' })).ok).toBe(false);
});

test('skips records with unknown properties or unsafe style values', () => {
  const result = parseImport(exportJson([
    record({}),
    record({ id: 'r2', property: 'notAProperty' }),
    record({ id: 'r3', newValue: 'red; } body { display: none' }),
    record({ id: 'r4', type: 'attr', property: 'onclick', newValue: 'alert(1)' }),
  ]));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.page.records).toHaveLength(1);
    expect(result.skipped).toBe(3);
  }
});

test('accepts text and src records within limits', () => {
  const result = parseImport(exportJson([
    record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'a', newValue: 'b' }),
    record({ id: 'r3', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' }),
  ]));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.page.records).toHaveLength(2);
});

test('mergeRecords lets incoming records win on selector+property', () => {
  const existing = [record({}), record({ id: 'r2', property: 'fontSize', newValue: '40px' })];
  const incoming = [record({ id: 'r9', newValue: '#00ff00' })];
  const merged = mergeRecords(existing, incoming);
  expect(merged).toHaveLength(2);
  expect(merged.find((r) => r.property === 'color')!.newValue).toBe('#00ff00');
});

test('importPageEdits merges into the stored page', async () => {
  await savePageEdits({ ...emptyPageEdits('https://example.com/page', 'T', 'now'), records: [record({})] });
  await importPageEdits({
    ...emptyPageEdits('https://example.com/page', 'T', 'later'),
    records: [record({ id: 'r9', newValue: '#00ff00' }), record({ id: 'r10', property: 'fontSize', oldValue: '16px', newValue: '20px' })],
  });
  const stored = await loadPageEdits('https://example.com/page');
  expect(stored!.records).toHaveLength(2);
  expect(stored!.records.find((r) => r.property === 'color')!.newValue).toBe('#00ff00');
});

test('accepts the extended style properties', () => {
  const result = parseImport(exportJson([
    record({ id: 'a', property: 'textAlign', oldValue: 'left', newValue: 'center' }),
    record({ id: 'b', property: 'letterSpacing', oldValue: 'normal', newValue: '0.5px' }),
    record({ id: 'c', property: 'textTransform', oldValue: 'none', newValue: 'uppercase' }),
    record({ id: 'd', property: 'borderRadius', oldValue: '0px', newValue: '12px' }),
    record({ id: 'e', property: 'opacity', oldValue: '1', newValue: '0.5' }),
    record({ id: 'f', property: 'backgroundImage', oldValue: 'none', newValue: 'url("https://example.com/a.png")' }),
  ]));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.page.records).toHaveLength(6);
});

test('background image values must be plain http(s) or data-image urls', () => {
  const result = parseImport(exportJson([
    record({ id: 'a', property: 'backgroundImage', newValue: 'url("javascript:alert(1)")' }),
    record({ id: 'b', property: 'backgroundImage', newValue: 'linear-gradient(red, blue)' }),
    record({ id: 'c', property: 'backgroundImage', newValue: 'url("data:image/png;base64,AAAA")' }),
  ]));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.page.records).toHaveLength(1);
    expect(result.page.records[0].id).toBe('c');
  }
});

test('move records import, and a forged index does not', () => {
  const page = (record: object) =>
    JSON.stringify({
      version: 1, url: 'https://a.com/p', title: '', updatedAt: 'n',
      records: [{
        id: 'm1', selector: '#x', fallbackSelectors: [], elementLabel: 'p',
        enabled: true, createdAt: 'n', updatedAt: 'n',
        type: 'move', property: 'domIndex', oldValue: '3', newValue: '0',
        ...record,
      }],
    });
  const good = parseImport(page({}));
  expect(good.ok && good.page.records).toHaveLength(1);

  for (const bad of [{ newValue: '-1' }, { newValue: '1e9' }, { property: 'order' }, { oldValue: 'x' }]) {
    const result = parseImport(page(bad));
    expect(result.ok && result.skipped, JSON.stringify(bad)).toBe(1);
  }
});

test('custom style properties import under the custom gate', () => {
  const page = (record: object) =>
    JSON.stringify({
      version: 1, url: 'https://a.com/p', title: '', updatedAt: 'n',
      records: [{
        id: 'cc1', selector: '#x', fallbackSelectors: [], elementLabel: 'div',
        enabled: true, createdAt: 'n', updatedAt: 'n',
        type: 'style', property: 'transform', oldValue: 'none', newValue: 'rotate(3deg)',
        ...record,
      }],
    });
  const good = parseImport(page({}));
  expect(good.ok && good.page.records).toHaveLength(1);

  for (const bad of [
    { newValue: '10px} body{display:none' },
    { property: 'Transform' },
    { property: '--brand' },
    { newValue: 'expression(alert(1))' },
  ]) {
    const result = parseImport(page(bad));
    expect(result.ok && result.skipped, JSON.stringify(bad)).toBe(1);
  }
});

test('a selector that could never be a selector is refused', () => {
  const body = (selector: string) =>
    JSON.stringify({
      version: 1, url: 'https://a.com/p', title: '', updatedAt: 'n',
      records: [{
        id: 'x1', selector, fallbackSelectors: [], elementLabel: 'h1',
        type: 'style', property: 'color', oldValue: '#000', newValue: '#f00',
        enabled: true, createdAt: 'n', updatedAt: 'n',
      }],
    });
  for (const hostile of ['h1 { } body { display: none } h1', 'h1 /* x */', 'h1 @media']) {
    const result = parseImport(body(hostile));
    expect(result.ok && result.skipped, hostile).toBe(1);
  }
  // The control that matters: ordinary selectors — child combinators included — must
  // survive. Asserting only .ok passes even when every record was dropped.
  for (const ordinary of [
    '.card > h1:nth-child(2)',
    '#main > div > p',
    '[data-tweakpage-clone="abc-123"] > span:nth-child(1)',
    'ul li:first-child',
  ]) {
    const result = parseImport(body(ordinary));
    expect(result.ok && result.skipped, ordinary).toBe(0);
  }
});

describe('a picked image inside a record', () => {
  const shared = (newValue: string, property = 'src') =>
    parseImport(JSON.stringify({
      version: 1, url: 'https://a.com/p', title: '', updatedAt: 'n',
      records: [{
        id: 'i1', selector: 'img#hero', fallbackSelectors: [], elementLabel: 'img',
        type: property === 'backgroundImage' ? 'style' : 'attr',
        property, oldValue: 'none', newValue,
        enabled: true, createdAt: 'n', updatedAt: 'n',
      }],
    }));
  const image = (chars: number) => 'data:image/png;base64,' + 'A'.repeat(chars);
  /** How many records the import threw away. */
  const dropped = (value: string, property?: string) => {
    const result = shared(value, property);
    return result.ok ? result.skipped : 'parse failed';
  };

  test('survives export and import — the path that needs no setup', () => {
    // Every real photo used to be dropped here, silently, on both routes.
    expect(dropped(image(300_000))).toBe(0);
    expect(dropped(`url("${image(300_000)}")`, 'backgroundImage')).toBe(0);
  });

  test('but not one larger than the picker itself allows', () => {
    expect(dropped(image(3_000_000)), 'the bound is the picker’s, not unlimited').toBe(1);
  });

  test('an ordinary URL keeps its tight limit', () => {
    expect(dropped('https://cdn.example.com/' + 'a'.repeat(3000))).toBe(1);
    expect(dropped('https://cdn.example.com/a.png')).toBe(0);
  });

  test('a long data: URL that is not an image is still refused', () => {
    expect(
      dropped('data:text/html;base64,' + 'A'.repeat(300_000)),
      'the exemption is for pictures, not for size',
    ).toBe(1);
  });
});

describe('what a link is allowed to hand the tab', () => {
  const record = (extra: object) => ({
    id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
    type: 'text', property: 'textContent', oldValue: 'a', newValue: 'b',
    enabled: true, createdAt: 'n', updatedAt: 'n', ...extra,
  });
  const page = (records: object[], extra: object = {}) =>
    JSON.stringify({ version: 1, url: 'https://a.com/p', title: '', updatedAt: 'n', records, ...extra });

  test('a body too large to be a real share is refused before it is parsed', () => {
    // Whoever controls the object controls its size; reading it whole is the attack.
    const huge = 'x'.repeat(25 * 1024 * 1024);
    expect(parseImport(`{"version":1,"url":"https://a.com/p","records":[],"pad":"${huge}"}`)).toEqual({
      ok: false, error: 'too large',
    });
  });

  test('unbounded fallback selectors are refused', () => {
    const many = Array.from({ length: 200 }, (_, i) => `.f${i}`);
    const result = parseImport(page([record({ fallbackSelectors: many })]));
    expect(result.ok && result.skipped).toBe(1);
    expect(parseImport(page([record({ fallbackSelectors: many.slice(0, 10) })])).ok).toBe(true);
  });

  test('every string in a record is bounded', () => {
    const long = 'x'.repeat(5000);
    for (const field of ['elementLabel', 'textFingerprint', 'createdAt', 'updatedAt']) {
      const result = parseImport(page([record({ [field]: long })]));
      expect(result.ok && result.skipped, field).toBe(1);
    }
  });

  test('variants cannot smuggle in more records than the cap', () => {
    const many = Array.from({ length: 500 }, (_, i) => record({ id: `r${i}` }));
    const result = parseImport(page(many, {
      variants: [
        { id: 'v1', name: 'A', savedAt: 'n', records: many },
        { id: 'v2', name: 'B', savedAt: 'n', records: many },
      ],
    }));
    expect(result).toEqual({ ok: false, error: 'too many records' });
  });

  test('a page with a long but sane title is kept, trimmed', () => {
    const result = parseImport(page([record({})], { title: 'T'.repeat(1000) }));
    expect(result.ok && result.page.title.length).toBeLessThanOrEqual(300);
  });
});

describe('context arriving over a link', () => {
  const withContext = (context: unknown) =>
    parseImport(
      JSON.stringify({
        version: 1,
        url: 'https://a.com/p',
        title: '',
        updatedAt: 'n',
        records: [
          {
            id: 'c1',
            selector: '.t',
            fallbackSelectors: [],
            elementLabel: 'span',
            type: 'text',
            property: 'textContent',
            oldValue: 'a',
            newValue: 'b',
            enabled: true,
            createdAt: 'n',
            updatedAt: 'n',
            context,
          },
        ],
      }),
    );

  test('a well-formed chain comes through intact', () => {
    const chain = [{ tag: 'span' }, { tag: 'div', label: 'Goals', classes: ['card_root'] }];
    const parsed = withContext(chain);
    expect(parsed.ok && parsed.page.records[0]!.context).toEqual(chain);
  });

  test('a record with no context is still a record', () => {
    const parsed = withContext(undefined);
    expect(parsed.ok && parsed.page.records).toHaveLength(1);
  });

  test('an unbounded one is refused', () => {
    // Nothing here shows up as an edit, so without a bound it is free weight in a share.
    expect(withContext(Array.from({ length: 40 }, () => ({ tag: 'div' }))).ok).toBe(true);
    const parsed = withContext(Array.from({ length: 40 }, () => ({ tag: 'div' })));
    expect(parsed.ok && parsed.page.records, 'the whole record goes, as with any other bad field').toHaveLength(0);
  });

  test('so is one carrying anything that is not a string', () => {
    for (const bad of [
      'not an array',
      [{ tag: 42 }],
      [{ tag: 'div', label: { toString: 1 } }],
      [{ tag: 'div', classes: 'flex' }],
      [{ tag: 'div', classes: Array.from({ length: 30 }, () => 'x') }],
      [{ tag: 'div', onclick: 'alert(1)' }],
      [{ tag: 'div', label: 'x'.repeat(500) }],
    ]) {
      const parsed = withContext(bad);
      expect(parsed.ok && parsed.page.records.length, JSON.stringify(bad).slice(0, 40)).toBe(0);
    }
  });
});
