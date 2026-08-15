import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { ApplierEngine } from './engine';
import { watchUrlChanges } from './navigation';
import { savePageEdits } from '../edits/storage';
import { emptyPageEdits, type EditRecord } from '../edits/types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1', selector: '.title', fallbackSelectors: [], elementLabel: 'h1.title',
    type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed',
    enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

async function seed(url: string, records: EditRecord[]): Promise<void> {
  await savePageEdits({ ...emptyPageEdits(url, 'T', '2026-08-15T10:00:00.000Z'), records });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 class="title">Original</h1>';
});

test('start applies stored edits for the url', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('start stays idle when the url has no edits', async () => {
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/other');
  expect(document.querySelector('style[data-pg-editor]')).toBeNull();
});

test('re-applies after a mutation replaces the node', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  document.body.innerHTML = '<h1 class="title">Original</h1>';
  await wait(120);
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('storage change updates the applied edits', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  await seed('https://a.com/page', [record({ newValue: 'Newest' })]);
  await wait(20);
  expect(document.querySelector('.title')!.textContent).toBe('Newest');
});

test('navigate loads edits for the new url', async () => {
  await seed('https://a.com/second', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/first');
  expect(document.querySelector('.title')!.textContent).toBe('Original');
  await engine.navigate('https://a.com/second');
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('overlapping navigations settle on the newest url', async () => {
  await seed('https://a.com/first', [record({ newValue: 'First' })]);
  await seed('https://a.com/second', [record({ newValue: 'Second' })]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/none');
  const first = engine.navigate('https://a.com/first');
  const second = engine.navigate('https://a.com/second');
  await Promise.all([first, second]);
  expect(document.querySelector('.title')!.textContent).toBe('Second');
});

test('watchUrlChanges fires on popstate when the href changed', () => {
  const seen: string[] = [];
  watchUrlChanges(window, (url) => seen.push(url));
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(seen).toHaveLength(0); // href unchanged → no fire
  history.pushState({}, '', '/new-path');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(seen).toHaveLength(1);
  expect(seen[0]).toContain('/new-path');
});

test('pauses reapply while the editor previews the original', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  expect(document.querySelector('.title')!.textContent).toBe('Changed');

  document.dispatchEvent(new CustomEvent('pg-editor:preview', { detail: { on: true } }));
  document.querySelector('.title')!.textContent = 'Original';
  await wait(120);
  expect(document.querySelector('.title')!.textContent).toBe('Original');

  document.dispatchEvent(new CustomEvent('pg-editor:preview', { detail: { on: false } }));
  await wait(120);
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});
