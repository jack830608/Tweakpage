import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import { EditsController } from './controller';
import { applyAll } from '../../lib/edits/apply';
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

describe('walking a wizard that re-labels one list of buttons', () => {
  /**
   * The whole journey, not one symptom of it.
   *
   * positivegrid.com/pages/product-selector asks a question at a time. Each step draws
   * its options into the same container, so every step's first option mints the same
   * selector — and the answers already given stay on screen above them. Three separate
   * bugs lived in here and each was found by walking one step further than the last fix
   * had been tested.
   */
  const STEPS = [
    ['Live Performance / Busking', 'Jamming'],
    ['Multiple inputs', 'Just my guitar'],
    ['Indoors (cafes, controlled spaces)', 'Outdoors / mixed environments'],
  ];

  function render(step: number, answered: string[]): void {
    document.body.innerHTML = `<div class="log">${answered
      .map((a) => `<div class="answer"><span>${a}</span></div>`)
      .join('')}<div class="pl-10">${STEPS[step]!
      .map((o) => `<button class="opt"><span>${o}</span></button>`)
      .join('')}</div></div>`;
  }
  const options = () => Array.from(document.querySelectorAll('.pl-10 span'));
  const texts = () => options().map((el) => el.textContent);

  test('each step keeps its own edit, and picks up nobody else\'s', () => {
    const c = controller();
    const answered: string[] = [];
    for (const [step, choices] of STEPS.entries()) {
      render(step, answered);
      // What the observer does when the wizard redraws: replay everything on the new DOM.
      applyAll(c.getPage().records, document);
      expect(texts(), `step ${step + 1} starts as the site drew it`).toEqual(choices);

      const own = options()[0]!.textContent!;
      c.recordEdit(options()[0]!, 'text', 'textContent', own, `${own} JACK`);
      expect(texts(), `step ${step + 1} shows its own edit and only its own`).toEqual([
        `${own} JACK`,
        choices[1],
      ]);
      answered.push(own);
    }

    const records = c.getPage().records;
    expect(records, 'one record per step, none overwritten').toHaveLength(3);
    // The precondition the whole case rests on: a selector cannot tell these apart.
    expect(new Set(records.map((r) => r.selector)).size, 'all three mint one selector').toBe(1);
    // oldValue is what Clear and undo write back. A record holding another step's words
    // here puts them on the page the moment anything is reverted.
    expect(records.map((r) => r.oldValue)).toEqual(STEPS.map(([first]) => first));
    expect(records.map((r) => r.newValue)).toEqual(STEPS.map(([first]) => `${first} JACK`));
    expect(records.map((r) => r.textFingerprint)).toEqual(STEPS.map(([first]) => first));
  });

  test('the panel reads the selected element, not the selector', () => {
    const c = controller();
    render(0, []);
    c.recordEdit(options()[0]!, 'text', 'textContent', STEPS[0]![0]!, 'Step one JACK');
    render(1, [STEPS[0]![0]!]);
    applyAll(c.getPage().records, document);
    expect(c.recordFor(options()[0]!, 'textContent'), 'step two is unedited').toBeUndefined();

    c.recordEdit(options()[0]!, 'text', 'textContent', STEPS[1]![0]!, 'Step two JACK');
    expect(c.recordFor(options()[0]!, 'textContent')?.newValue).toBe('Step two JACK');
  });

  test('going back to a step shows that step\'s edit again', () => {
    // Refusing has to be about the arrangement of the page, not about the record: the
    // wizard has a "Change last answer" button, and the edit must come back with it.
    const c = controller();
    render(0, []);
    c.recordEdit(options()[0]!, 'text', 'textContent', STEPS[0]![0]!, 'Step one JACK');
    render(1, [STEPS[0]![0]!]);
    applyAll(c.getPage().records, document);
    render(0, []);
    applyAll(c.getPage().records, document);
    expect(texts()).toEqual(['Step one JACK', STEPS[0]![1]]);
  });
});

describe('a wizard that keeps its nodes and swaps their words', () => {
  // The harder half of the same page: React reuses a keyed list whose items did not
  // change shape, so the element edited on step two is the same object edited on step
  // one. Everything the controller remembers about an element by identity is stale the
  // moment the site rewrites it.
  const OPTIONS = ['Live Performance / Busking', 'Multiple inputs', 'Indoors (cafes)'];

  function relabel(text: string): Element {
    if (!document.querySelector('.pl-10')) {
      document.body.innerHTML = '<div class="pl-10"><button class="opt"><span></span></button></div>';
    }
    const span = document.querySelector('.pl-10 span')!;
    span.textContent = text;
    return span;
  }

  test('a second edit on a reused node describes the words that are there now', () => {
    const c = controller();
    c.recordEdit(relabel(OPTIONS[0]!), 'text', 'textContent', OPTIONS[0]!, `${OPTIONS[0]} JACK`);
    expect(document.querySelector('.pl-10 span')!.textContent).toBe(`${OPTIONS[0]} JACK`);

    // The site advances: same node, new question.
    const span = relabel(OPTIONS[1]!);
    applyAll(c.getPage().records, document);
    expect(span.textContent, 'the first edit does not follow the node').toBe(OPTIONS[1]);

    c.recordEdit(span, 'text', 'textContent', OPTIONS[1]!, `${OPTIONS[1]} JACK`);
    const second = c.getPage().records.find((r) => r.newValue === `${OPTIONS[1]} JACK`)!;
    // Cached against the element and never invalidated, this held step one's words —
    // so the new record could not recognise the element it had just been made from, and
    // the page never changed while the panel showed the edit as made.
    expect(second.textFingerprint, 'the fingerprint describes this step').toBe(OPTIONS[1]);
    expect(second.elementLabel).toContain(OPTIONS[1]);
    expect(document.querySelector('.pl-10 span')!.textContent).toBe(`${OPTIONS[1]} JACK`);
  });
});

describe('another writer on the same page', () => {
  test('and clearing the page from the popup is not undone by the next edit', async () => {
    document.body.innerHTML = '<h1 id="title">Original</h1>';
    const c = controller();
    c.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
    const key = `page:${location.origin}${location.pathname}`;
    expect((await fakeBrowser.storage.local.get(key))[key]).toBeTruthy();

    // What the popup's Clear does.
    await fakeBrowser.storage.local.remove(key);
    await new Promise((r) => setTimeout(r, 20));
    expect(c.getPage().records, 'the panel noticed').toEqual([]);
    expect(document.getElementById('title')!.textContent, 'and put the page back').toBe('Original');

    c.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Second');
    const stored = (await fakeBrowser.storage.local.get(key))[key] as { records: unknown[] };
    expect(stored.records, 'the cleared record did not come back').toHaveLength(1);
  });
});
