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
