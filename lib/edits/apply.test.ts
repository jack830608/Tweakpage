import { beforeEach, expect, test } from 'vitest';
import { applyAll, ensureStyleTag, revertAll } from './apply';
import type { EditRecord } from './types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1',
    selector: '.title',
    fallbackSelectors: [],
    elementLabel: 'h1.title',
    type: 'style',
    property: 'color',
    oldValue: 'rgb(0, 0, 0)',
    newValue: '#ff0000',
    enabled: true,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 class="title">Original</h1><img class="hero" src="/a.png">';
});

test('applyAll writes style rules into a single data-pg-editor tag', () => {
  applyAll([record({})], document);
  const tags = document.querySelectorAll('style[data-pg-editor]');
  expect(tags).toHaveLength(1);
  expect(tags[0].textContent).toBe('.title { color: #ff0000 !important; }');
});

test('applyAll is idempotent: second run keeps one tag and identical css', () => {
  applyAll([record({})], document);
  const tag = document.querySelector('style[data-pg-editor]')!;
  applyAll([record({})], document);
  expect(document.querySelectorAll('style[data-pg-editor]')).toHaveLength(1);
  expect(document.querySelector('style[data-pg-editor]')).toBe(tag);
});

test('applyAll applies text edits idempotently', () => {
  const r = record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed' });
  applyAll([r], document);
  const h1 = document.querySelector('.title')!;
  expect(h1.textContent).toBe('Changed');
  const statuses = applyAll([r], document);
  expect(h1.textContent).toBe('Changed');
  expect(statuses.get('r2')).toBe('applied');
});

test('applyAll applies attr edits', () => {
  const r = record({ id: 'r3', selector: '.hero', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' });
  applyAll([r], document);
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/b.png');
});

test('applyAll reports not-found and disabled statuses', () => {
  const statuses = applyAll(
    [record({ id: 'r4', selector: '.missing' }), record({ id: 'r5', enabled: false })],
    document,
  );
  expect(statuses.get('r4')).toBe('not-found');
  expect(statuses.get('r5')).toBe('disabled');
});

test('revertAll removes the style tag and restores text and attrs', () => {
  const text = record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed' });
  const attr = record({ id: 'r3', selector: '.hero', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' });
  applyAll([record({}), text, attr], document);
  revertAll([record({}), text, attr], document);
  expect(document.querySelector('style[data-pg-editor]')).toBeNull();
  expect(document.querySelector('.title')!.textContent).toBe('Original');
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/a.png');
});

test('ensureStyleTag reuses an existing tag', () => {
  const a = ensureStyleTag(document);
  const b = ensureStyleTag(document);
  expect(a).toBe(b);
});
