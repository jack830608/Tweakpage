import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { EditsController } from './controller';
import { loadPageEdits } from '../../lib/edits/storage';
import type { EditRecord } from '../../lib/edits/types';

const NOW = () => '2026-08-17T10:00:00.000Z';

function shared(): EditRecord[] {
  return [
    {
      id: 'shared1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
      type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'From a colleague',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    },
  ];
}

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1>Original</h1>';
  history.replaceState({}, '', '/page');
});

test('a shared link shows its edits without writing them to this machine', async () => {
  const c = new EditsController(null, document, NOW);
  c.previewShared(shared());

  expect(document.querySelector('h1')!.textContent).toBe('From a colleague');
  // Someone else's proposal is not your saved work: closing the tab should leave nothing.
  expect(await loadPageEdits(location.href)).toBeNull();
});

test('keeping a shared page is what makes it yours', async () => {
  const c = new EditsController(null, document, NOW);
  c.previewShared(shared());
  c.keepShared();

  const saved = await loadPageEdits(location.href);
  expect(saved?.records).toHaveLength(1);
});

test('editing while previewing means you have taken it on', async () => {
  const c = new EditsController(null, document, NOW);
  c.previewShared(shared());
  c.recordEdit(document.querySelector('h1')!, 'style', 'color', 'rgb(0, 0, 0)', '#059669');

  const saved = await loadPageEdits(location.href);
  expect(saved?.records, 'your edit and the shared ones save together').toHaveLength(2);
});

test('previewing does not disturb edits already saved for the page', async () => {
  const c = new EditsController(null, document, NOW);
  c.recordEdit(document.querySelector('h1')!, 'style', 'fontSize', '16px', '32px');
  const before = await loadPageEdits(location.href);

  c.previewShared(shared());
  expect(await loadPageEdits(location.href), 'storage is untouched by a preview').toEqual(before);
});

test('the panel is never told a preview is saved', async () => {
  const c = new EditsController(null, document, NOW);
  c.recordEdit(document.querySelector('h1')!, 'style', 'color', 'rgb(0, 0, 0)', '#059669');
  await vi.waitFor(() => expect(c.getSaveState().state).toBe('saved'));

  // A footer reading "Saved" over edits that exist nowhere but this tab is the same
  // false-status bug as the disabled button that still looked clickable.
  c.previewShared(shared());
  expect(c.getSaveState().state).toBe('preview');

  c.keepShared();
  await vi.waitFor(() => expect(c.getSaveState().state).toBe('saved'));
});

test("the panel's reset also honours a baseline the applier retired", async () => {
  document.body.innerHTML = '<h1>Original</h1>';
  const c = new EditsController(null, document, NOW);
  c.recordEdit(document.querySelector('h1')!, 'text', 'textContent', 'Original', 'Edited');
  const id = c.getPage().records[0].id;

  // The applier saw the site rewrite this value and announced the new baseline.
  document.dispatchEvent(
    new CustomEvent('pg-editor:baseline', { detail: { updates: [{ id, oldValue: 'Live price' }] } }),
  );

  c.deleteRecord(id);
  expect(document.querySelector('h1')!.textContent, 'reset must not write history').toBe(
    'Live price',
  );
});

test('stepping an element back to where it started leaves no record behind', async () => {
  document.body.innerHTML = '<div><p id="a">A</p><p id="b">B</p><p id="c">C</p></div>';
  const c = new EditsController(null, document, NOW);
  const el = document.getElementById('b')!;
  const order = () => [...document.querySelectorAll('p')].map((p) => p.id).join('');

  c.moveElement(el, -1);
  expect(order()).toBe('bac');
  expect(c.getPage().records).toHaveLength(1);

  c.moveElement(el, 1);
  expect(order()).toBe('abc');
  expect(c.getPage().records, 'a round trip is not an edit').toHaveLength(0);
});

test('the edges of a container have nowhere further to go', () => {
  document.body.innerHTML = '<div><p id="a">A</p><p id="b">B</p></div>';
  const c = new EditsController(null, document, NOW);
  expect(c.canMove(document.getElementById('a')!, -1)).toBe(false);
  expect(c.canMove(document.getElementById('a')!, 1)).toBe(true);
  expect(c.canMove(document.getElementById('b')!, 1)).toBe(false);

  c.moveElement(document.getElementById('a')!, -1);
  expect(c.getPage().records, 'refused moves record nothing').toHaveLength(0);
});

test('two moves of the same element coalesce into one record with the true origin', () => {
  document.body.innerHTML = '<div><p id="a">A</p><p id="b">B</p><p id="c">C</p></div>';
  const c = new EditsController(null, document, NOW);
  const el = document.getElementById('c')!;
  c.moveElement(el, -1);
  c.moveElement(el, -1);
  expect([...document.querySelectorAll('p')].map((p) => p.id).join('')).toBe('cab');
  expect(c.getPage().records).toHaveLength(1);
  expect(c.getPage().records[0].oldValue, 'undo target is the pristine position').toBe('2');
  expect(c.getPage().records[0].newValue).toBe('0');
});
