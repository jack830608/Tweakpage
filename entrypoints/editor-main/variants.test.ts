import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { EditsController } from './controller';

const NOW = () => '2026-08-16T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title" style="color: rgb(0, 0, 0)">Original</h1>';
  history.replaceState({}, '', '/page');
});

function withEdit(value: string) {
  const c = new EditsController(null, document, NOW);
  c.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', value);
  return c;
}

test('a proposal keeps the edits it was saved with', () => {
  const c = withEdit('Version A');
  c.saveVariant('A');
  expect(c.getVariants()).toHaveLength(1);
  expect(c.getVariants()[0].records[0].newValue).toBe('Version A');
});

test('switching between proposals swaps what the page shows', () => {
  const c = withEdit('Version A');
  c.saveVariant('A');
  c.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Version B');
  c.saveVariant('B');
  expect(document.getElementById('title')!.textContent).toBe('Version B');

  const a = c.getVariants().find((v) => v.name === 'A')!;
  c.loadVariant(a.id);
  expect(document.getElementById('title')!.textContent).toBe('Version A');
});

test('switching is undoable, like any other change', () => {
  const c = withEdit('Version A');
  c.saveVariant('A');
  c.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Version B');
  c.loadVariant(c.getVariants()[0].id);
  expect(document.getElementById('title')!.textContent).toBe('Version A');

  c.undo();
  expect(document.getElementById('title')!.textContent).toBe('Version B');
});

test('saving under an existing name replaces that proposal', () => {
  const c = withEdit('First try');
  c.saveVariant('A');
  c.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Second try');
  c.saveVariant('A');
  expect(c.getVariants()).toHaveLength(1);
  expect(c.getVariants()[0].records[0].newValue).toBe('Second try');
});

test('a deleted proposal leaves the live edits alone', () => {
  const c = withEdit('Version A');
  c.saveVariant('A');
  c.deleteVariant(c.getVariants()[0].id);
  expect(c.getVariants()).toHaveLength(0);
  expect(document.getElementById('title')!.textContent).toBe('Version A');
});

test('proposals travel with the saved page', async () => {
  const c = withEdit('Version A');
  c.saveVariant('A');
  const stored = await fakeBrowser.storage.local.get('page:http://localhost:3000/page');
  const page = Object.values(stored)[0] as { variants?: unknown[] };
  expect(page.variants).toHaveLength(1);
});
