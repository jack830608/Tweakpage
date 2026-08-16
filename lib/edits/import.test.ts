import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
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
