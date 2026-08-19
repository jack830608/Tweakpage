import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import { EditsController } from './controller';
import { loadPageEdits } from '../../lib/edits/storage';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});

function controller(): EditsController {
  return new EditsController(null, document, NOW);
}

test('recordEdit creates a record, applies it, and persists', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(c.getPage().records).toHaveLength(1);
  expect(document.querySelector('style[data-tweakpage-style]')!.textContent).toContain('#ff0000');
  const stored = await loadPageEdits(location.href);
  expect(stored?.records).toHaveLength(1);
  expect(c.getStatus(c.getPage().records[0].id)).toBe('applied');
});

test('recordEdit coalesces repeat edits to the same property', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  c.recordEdit(el, 'style', 'color', '#ff0000', '#00ff00');
  expect(c.getPage().records).toHaveLength(1);
  expect(c.getPage().records[0].oldValue).toBe('rgb(0, 0, 0)');
  expect(c.getPage().records[0].newValue).toBe('#00ff00');
});

test('editing back to the original value deletes the record and reverts', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  expect(el.textContent).toBe('Changed');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Original');
  expect(c.getPage().records).toHaveLength(0);
  expect(el.textContent).toBe('Original');
  expect(await loadPageEdits(location.href)).toBeNull();
});

test('a new edit equal to its old value is a no-op', () => {
  const c = controller();
  c.recordEdit(document.getElementById('title')!, 'style', 'color', '#000000', '#000000');
  expect(c.getPage().records).toHaveLength(0);
});

test('deleteRecord reverts dom edits and removes the record', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.deleteRecord(c.getPage().records[0].id);
  expect(el.textContent).toBe('Original');
  expect(c.getPage().records).toHaveLength(0);
});

test('revertAllEdits clears everything', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.revertAllEdits();
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  expect(el.textContent).toBe('Original');
  expect(await loadPageEdits(location.href)).toBeNull();
});

test('subscribe notifies on every commit and getPage stays stable between commits', () => {
  const c = controller();
  let calls = 0;
  c.subscribe(() => calls++);
  const snapshotBefore = c.getPage();
  expect(c.getPage()).toBe(snapshotBefore);
  c.recordEdit(document.getElementById('title')!, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(calls).toBe(1);
  expect(c.getPage()).not.toBe(snapshotBefore);
});

test('recordFor finds the record for an element and property', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  expect(c.recordFor(el, 'color')).toBeUndefined();
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(c.recordFor(el, 'color')?.newValue).toBe('#ff0000');
});

test('setRecords guards against recording edits after an SPA navigation changed the URL', async () => {
  const c = controller();
  const originalUrl = location.href;
  const el = document.getElementById('title')!;
  history.replaceState({}, '', '/other');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  expect(c.getPage().records).toHaveLength(0);
  expect(await loadPageEdits(originalUrl)).toBeNull();
});

test('preview original reverts edits without touching storage, restores on exit', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.setPreviewOriginal(true);
  expect(c.isPreviewingOriginal()).toBe(true);
  expect(el.textContent).toBe('Original');
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  expect(c.getPage().records).toHaveLength(1);
  expect((await loadPageEdits(location.href))?.records).toHaveLength(1);
  c.setPreviewOriginal(false);
  expect(c.isPreviewingOriginal()).toBe(false);
  expect(el.textContent).toBe('Changed');
});

test('editing while previewing exits preview first', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  c.setPreviewOriginal(true);
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  expect(c.isPreviewingOriginal()).toBe(false);
  expect(el.textContent).toBe('Changed');
  expect(document.querySelector('style[data-tweakpage-style]')!.textContent).toContain('#ff0000');
});

test('undo restores the previous state including dom values', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(c.canUndo()).toBe(true);
  c.undo();
  expect(c.getPage().records).toHaveLength(1);
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  c.undo();
  expect(c.getPage().records).toHaveLength(0);
  expect(el.textContent).toBe('Original');
  expect(c.canUndo()).toBe(false);
});

test('redo reapplies an undone change; a new edit clears the redo stack', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.undo();
  expect(el.textContent).toBe('Original');
  expect(c.canRedo()).toBe(true);
  c.redo();
  expect(el.textContent).toBe('Changed');
  expect(c.getPage().records).toHaveLength(1);
  c.undo();
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(c.canRedo()).toBe(false);
});

test('continuous typing on the same field is one undo step', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'C');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Ch');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Cha');
  c.undo();
  expect(c.getPage().records).toHaveLength(0);
  expect(el.textContent).toBe('Original');
});

test('undo exits original preview first', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.setPreviewOriginal(true);
  c.undo();
  expect(c.isPreviewingOriginal()).toBe(false);
  expect(el.textContent).toBe('Original');
  expect(c.getPage().records).toHaveLength(0);
});

test('toggling a record off reverts its dom effect and back on reapplies it', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  const id = c.getPage().records[0].id;
  c.toggleRecord(id);
  expect(el.textContent).toBe('Original');
  expect(c.getPage().records[0].enabled).toBe(false);
  expect(c.getStatus(id)).toBe('disabled');
  c.toggleRecord(id);
  expect(el.textContent).toBe('Changed');
  expect(c.getPage().records[0].enabled).toBe(true);
});

test('toggling a style record off removes its css rule', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  const id = c.getPage().records[0].id;
  c.toggleRecord(id);
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  c.toggleRecord(id);
  expect(document.querySelector('style[data-tweakpage-style]')!.textContent).toContain('#ff0000');
});

describe('two elements that a selector cannot tell apart', () => {
  // The wizard again: step one's first option and step three's first option are the same
  // shape in the same place, so they mint the same selector. The page was right — the fix
  // to resolution saw to that — but the panel was reading the other one's record.
  const step = (text: string) =>
    `<div class="flex"><button class="opt"><span>${text}</span></button></div>`;
  const span = () => document.querySelector('span')!;

  const afterEditingStepOne = () => {
    document.body.innerHTML = step('Live Performance / Busking');
    const c = controller();
    c.recordEdit(
      span(),
      'text',
      'textContent',
      'Live Performance / Busking',
      'JACK Live Performance / Busking',
    );
    const minted = c.getPage().records[0]!.selector;
    document.body.innerHTML = step("Yes, I'm ready to buy");
    return { c, minted };
  };

  test('the panel shows nothing for an element that was never edited', () => {
    const { c, minted } = afterEditingStepOne();
    // The precondition this whole case rests on.
    expect(document.querySelectorAll(minted), 'the selector really does match both').toHaveLength(1);
    expect(c.recordFor(span(), 'textContent')).toBeUndefined();
  });

  test('and editing it writes a second record instead of overwriting the first', () => {
    // The worse half: the lookup that fed the panel also decided update-versus-create,
    // so typing here rewrote the step-one edit and lost it.
    const { c } = afterEditingStepOne();
    c.recordEdit(span(), 'text', 'textContent', "Yes, I'm ready to buy", 'JACK ready');
    const records = c.getPage().records;
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.newValue).sort()).toEqual([
      'JACK Live Performance / Busking',
      'JACK ready',
    ]);
  });

  test('the element that was edited still finds its own record', () => {
    // The guard against over-correcting: the point is to stop reading somebody else's
    // record, not to stop reading your own.
    document.body.innerHTML = step('Live Performance / Busking');
    const c = controller();
    c.recordEdit(span(), 'text', 'textContent', 'Live Performance / Busking', 'JACK Live');
    expect(c.recordFor(span(), 'textContent')?.newValue).toBe('JACK Live');
  });

  test('and keeps finding it after the page is rebuilt around it', () => {
    // Same element, same words, new nodes: a reload, or a framework remount. The record
    // is still about this element and the panel has to say so.
    document.body.innerHTML = step('Live Performance / Busking');
    const c = controller();
    c.recordEdit(span(), 'text', 'textContent', 'Live Performance / Busking', 'JACK Live');
    document.body.innerHTML = step('JACK Live');
    expect(c.recordFor(span(), 'textContent')?.newValue).toBe('JACK Live');
  });
});
