import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { EditsController } from './controller';
import { savePageEdits } from '../../lib/edits/storage';
import { emptyPageEdits, type EditRecord } from '../../lib/edits/types';

const NOW = () => '2026-08-16T10:00:00.000Z';

function record(overrides: Partial<EditRecord> = {}): EditRecord {
  return {
    id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
    type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'From storage',
    enabled: true, createdAt: 'n', updatedAt: 'n', ...overrides,
  };
}

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1>Original</h1>';
  history.replaceState({}, '', '/one');
});

test('following a route swaps in that page and drops the old undo history', async () => {
  await savePageEdits({
    ...emptyPageEdits('http://localhost:3000/two', 'Two', NOW()),
    records: [record()],
  });
  const c = new EditsController(null, document, NOW);
  c.recordEdit(document.querySelector('h1')!, 'text', 'textContent', 'Original', 'Edited here');
  expect(c.canUndo()).toBe(true);

  history.replaceState({}, '', '/two');
  await c.navigate(location.href);

  expect(c.getPage().url).toContain('/two');
  expect(c.getPage().records).toHaveLength(1);
  expect(document.querySelector('h1')!.textContent).toBe('From storage');
  expect(c.canUndo(), 'history belongs to the page it was made on').toBe(false);
});

test('the previous page stops being applied', async () => {
  const c = new EditsController(null, document, NOW);
  c.recordEdit(document.querySelector('h1')!, 'text', 'textContent', 'Original', 'Edited here');
  expect(document.querySelector('h1')!.textContent).toBe('Edited here');

  history.replaceState({}, '', '/two');
  await c.navigate(location.href);
  expect(document.querySelector('h1')!.textContent).toBe('Original');
});

test('a hash route counts as its own page', async () => {
  history.replaceState({}, '', '/app#/products/1');
  const c = new EditsController(null, document, NOW);
  expect(c.getPage().url).toContain('#/products/1');

  history.replaceState({}, '', '/app#/products/2');
  await c.navigate(location.href);
  expect(c.getPage().url).toContain('#/products/2');
});

test('an in-page anchor is not a navigation', async () => {
  const c = new EditsController(null, document, NOW);
  const before = c.getPage().url;
  history.replaceState({}, '', '/one#features');
  await c.navigate(location.href);
  expect(c.getPage().url).toBe(before);
});
