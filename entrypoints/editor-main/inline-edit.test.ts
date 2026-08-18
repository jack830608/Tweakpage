import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { canEditInline, startInlineEdit } from './inline-edit';
import { EditsController } from './controller';

const NOW = () => '2026-08-18T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  history.replaceState({}, '', '/page');
});

function controller() {
  return new EditsController(null, document, NOW);
}

describe('what can be edited in place', () => {
  test('an element with direct text can; a pure container cannot', () => {
    document.body.innerHTML = '<h1 id="a">Hello</h1><div id="b"><p>nested only</p></div>';
    expect(canEditInline(document.getElementById('a')!)).toBe(true);
    expect(canEditInline(document.getElementById('b')!)).toBe(false);
  });

  test("form fields and the page's own editables keep their own text story", () => {
    document.body.innerHTML =
      '<input id="i" value="x"><div id="c" contenteditable="true">theirs</div><div id="m" ' +
      'id2="x"></div><div id="tweakpage-marker"><button>Tweakpage · 1</button></div>';
    expect(canEditInline(document.getElementById('i')!)).toBe(false);
    expect(canEditInline(document.getElementById('c')!)).toBe(false);
    expect(canEditInline(document.querySelector('#tweakpage-marker button')!)).toBe(false);
  });
});

describe('the session', () => {
  test('makes the element a plaintext-only input and restores it on finish', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')! as HTMLElement;
    const session = startInlineEdit(el, controller());
    expect(el.getAttribute('contenteditable')).toBe('plaintext-only');
    // Our emerald editing outline is the affordance; the browser's blue focus ring on
    // top of it reads as a second, unexplained selection.
    expect(el.style.outline).toContain('none');
    session.finish();
    expect(el.hasAttribute('contenteditable')).toBe(false);
    expect(el.getAttribute('style'), 'no styling residue is left behind').toBeNull();
  });

  test("a page's own inline outline comes back exactly as it was", () => {
    document.body.innerHTML = '<h1 id="t" style="outline: 1px dotted red">Hello</h1>';
    const el = document.getElementById('t')! as HTMLElement;
    const session = startInlineEdit(el, controller());
    expect(el.style.outline).toContain('none');
    session.finish();
    expect(el.getAttribute('style')).toBe('outline: 1px dotted red');
  });

  test('pauses the applier while typing and releases it only after recording', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const states: Array<{ on: boolean; recorded: number }> = [];
    document.addEventListener('tweakpage:editing', (e) =>
      states.push({
        on: (e as CustomEvent<{ on: boolean }>).detail.on,
        recorded: c.getPage().records.length,
      }),
    );
    const session = startInlineEdit(el, c);
    el.textContent = 'Hello typed';
    session.finish();
    // The instant the applier is released it reapplies records over the element — if
    // the release comes before the diff, it rewrites the old value over the typing and
    // the commit then diffs against a page that no longer holds it.
    expect(states).toEqual([
      { on: true, recorded: 0 },
      { on: false, recorded: 1 },
    ]);
  });

  test('a plain element records one textContent edit, exactly like the panel', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const session = startInlineEdit(el, c);
    el.textContent = 'Hello world';
    session.finish();

    const records = c.getPage().records;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      type: 'text', property: 'textContent', oldValue: 'Hello', newValue: 'Hello world',
    });
  });

  test('markup records per run, and untouched runs stay silent', () => {
    document.body.innerHTML = '<h1 id="t">Make the page <span>yours</span></h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const session = startInlineEdit(el, c);
    el.querySelector('span')!.firstChild!.nodeValue = 'ours';
    session.finish();

    const records = c.getPage().records;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ property: 'textNode:1', oldValue: 'yours', newValue: 'ours' });
    expect(el.innerHTML, 'the span itself survives').toBe('Make the page <span>ours</span>');
  });

  test('typing the original back deletes the record instead of keeping a no-op', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    c.recordEdit(el, 'text', 'textContent', 'Hello', 'Edited');
    expect(c.getPage().records).toHaveLength(1);

    const session = startInlineEdit(el, c);
    el.textContent = 'Hello';
    session.finish();
    expect(c.getPage().records, 'back to the original is not an edit').toHaveLength(0);
  });

  test('a second inline edit coalesces with the first and keeps the true original', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();

    let session = startInlineEdit(el, c);
    el.textContent = 'First pass';
    session.finish();
    session = startInlineEdit(el, c);
    el.textContent = 'Second pass';
    session.finish();

    const records = c.getPage().records;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ oldValue: 'Hello', newValue: 'Second pass' });
  });

  test('an untouched session records nothing and pushes no undo step', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const session = startInlineEdit(el, c);
    session.finish();
    expect(c.getPage().records).toHaveLength(0);
    expect(c.canUndo()).toBe(false);
  });

  test('an untouched session is not an edit: it must not kill a pending redo', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1><p id="p">Para</p>';
    const c = controller();
    c.recordEdit(document.getElementById('t')!, 'text', 'textContent', 'Hello', 'Edited');
    c.recordEdit(document.getElementById('p')!, 'text', 'textContent', 'Para', 'Changed');
    c.undo();
    expect(c.canRedo()).toBe(true);

    // Double-click in, look, click away — recording a value that didn't change would
    // count as a new edit and clear the redo stack.
    const session = startInlineEdit(document.getElementById('t')!, c);
    session.finish();
    expect(c.canRedo(), 'looking at text is not editing it').toBe(true);
  });

  test('a structure change refuses to guess and says so', () => {
    document.body.innerHTML = '<h1 id="t">Make the page <span>yours</span></h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const onUnrecordable = vi.fn();
    const session = startInlineEdit(el, c, onUnrecordable);
    // Something outside plaintext-only's guarantees removed a node mid-edit.
    el.querySelector('span')!.remove();
    session.finish();
    expect(onUnrecordable).toHaveBeenCalled();
    expect(c.getPage().records, 'positional guesses would edit the wrong runs').toHaveLength(0);
  });

  test('finish is idempotent', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const session = startInlineEdit(el, c);
    el.textContent = 'Changed';
    session.finish();
    session.finish();
    expect(c.getPage().records).toHaveLength(1);
  });
});

describe('live sync while typing', () => {
  test('each input lands in the records before the session ends', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    startInlineEdit(el, c);

    el.textContent = 'Hello w';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    // The panel renders from records; without this, it goes stale until blur.
    expect(c.recordFor(el, 'textContent')?.newValue).toBe('Hello w');

    el.textContent = 'Hello world';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(c.recordFor(el, 'textContent')?.newValue).toBe('Hello world');
  });

  test('a typing run is one undo step, exactly like typing in the panel', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const session = startInlineEdit(el, c);
    for (const text of ['Hello w', 'Hello wo', 'Hello wor']) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    session.finish();

    c.undo();
    expect(c.getPage().records, 'one undo undoes the whole run').toHaveLength(0);
    expect(el.textContent).toBe('Hello');
  });

  test('half-composed IME text never reaches the records', () => {
    document.body.innerHTML = '<h1 id="t">你好</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    startInlineEdit(el, c);

    // Mid-composition: the visible text is an unfinished syllable.
    el.textContent = '你好ㄕ';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(c.recordFor(el, 'textContent'), 'unfinished syllables are not edits').toBeUndefined();

    // The composition commits.
    el.textContent = '你好世界';
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect(c.recordFor(el, 'textContent')?.newValue).toBe('你好世界');
  });

  test('input listeners do not outlive the session', () => {
    document.body.innerHTML = '<h1 id="t">Hello</h1>';
    const el = document.getElementById('t')!;
    const c = controller();
    const session = startInlineEdit(el, c);
    session.finish();

    el.textContent = 'Mutated by the page later';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(c.getPage().records, 'a finished session stops listening').toHaveLength(0);
  });
});

test('a run the panel cannot show is not editable in place either', () => {
  // The panel caps its boxes at 12 runs on purpose. Inline editing gave no such signal:
  // you typed into the 13th, it looked edited, and it was gone on reload. If a run
  // cannot be recorded it must not be editable.
  const runs = Array.from({ length: 14 }, (_, i) => `<span>r${i}</span>`).join(' ');
  document.body.innerHTML = `<p id="t">Lead ${runs}</p>`;
  const el = document.getElementById('t')!;
  expect(canEditInline(el), 'more runs than we can address is not editable').toBe(false);
});

test('an element within the run limit is still editable', () => {
  const runs = Array.from({ length: 3 }, (_, i) => `<span>r${i}</span>`).join(' ');
  document.body.innerHTML = `<p id="t">Lead ${runs}</p>`;
  expect(canEditInline(document.getElementById('t')!)).toBe(true);
});
