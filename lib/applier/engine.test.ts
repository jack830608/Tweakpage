import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApplierEngine } from './engine';
import { watchUrlChanges } from './navigation';
import { pageKey, savePageEdits } from '../edits/storage';
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

afterEach(() => {
  vi.restoreAllMocks();
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
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
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

  document.dispatchEvent(new CustomEvent('tweakpage:preview', { detail: { on: true } }));
  document.querySelector('.title')!.textContent = 'Original';
  await wait(120);
  expect(document.querySelector('.title')!.textContent).toBe('Original');

  document.dispatchEvent(new CustomEvent('tweakpage:preview', { detail: { on: false } }));
  await wait(120);
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('survives the badge count message throwing synchronously (invalidated context)', async () => {
  await seed('https://a.com/page', [record({})]);
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(() => {
    throw new Error('Extension context invalidated.');
  });
  const engine = new ApplierEngine(document);
  await expect(engine.start('https://a.com/page')).resolves.toBeUndefined();
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('navigate becomes a no-op once the extension context is invalidated', async () => {
  await seed('https://a.com/second', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/first');
  const original = fakeBrowser.runtime.id;
  (fakeBrowser.runtime as { id?: string }).id = undefined;
  await expect(engine.navigate('https://a.com/second')).resolves.toBeUndefined();
  expect(document.querySelector('.title')!.textContent).toBe('Original');
  fakeBrowser.runtime.id = original;
});

test('reports the edit count for the badge whenever edits change', async () => {
  const counts: number[] = [];
  fakeBrowser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as { type?: string; count?: number };
    if (m.type === 'tweakpage:count') counts.push(m.count ?? -1);
  });
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  expect(counts.at(-1)).toBe(1);
  await engine.navigate('https://a.com/nothing');
  expect(counts.at(-1)).toBe(0);
});

test('re-applies an attribute the page rewrites behind us', async () => {
  document.body.innerHTML = '<img class="hero" src="/old.jpg">';
  await seed('https://a.com/page', [
    record({ type: 'attr', selector: '.hero', property: 'src', oldValue: '/old.jpg', newValue: '/new.jpg' }),
  ]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/new.jpg');

  // Lazy loaders and gallery scripts do exactly this after we have applied.
  document.querySelector('.hero')!.setAttribute('src', '/old.jpg');
  await wait(120);
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/new.jpg');
});

test('marks the page while edits are applied, and stops when they are gone', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  // The editor may never be opened on this page; the marker is how anyone knows.
  expect(document.getElementById('tweakpage-marker')).toBeTruthy();

  await engine.navigate('https://a.com/clean');
  expect(document.getElementById('tweakpage-marker')).toBeNull();
});

test('counts only the edits actually in force', async () => {
  await seed('https://a.com/page', [
    record({}),
    record({ id: 'r2', property: 'color', type: 'style', enabled: false }),
  ]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  const label = document.getElementById('tweakpage-marker')!.shadowRoot!.textContent ?? '';
  expect(label).toContain('1');
});

test('clearing a page puts it back without a reload', async () => {
  const url = 'https://example.com/p';
  // Unique ids and selector: marks are looked up document-wide, and engines from other
  // tests keep observing this document — a shared id lets their records claim our node.
  document.body.innerHTML = '<h1 class="clr">Original</h1>';
  await seed(url, [
    record({ id: 'clr1', selector: '.clr' }),
    record({ id: 'clr2', selector: '.clr', type: 'style', property: 'color', oldValue: 'rgb(0, 0, 0)', newValue: 'rgb(5, 150, 105)' }),
  ]);
  const engine = new ApplierEngine(document);
  await engine.start(url);
  expect(document.querySelector('.clr')!.textContent).toBe('Changed');
  expect(document.querySelector('style[data-tweakpage-style]')).toBeTruthy();

  // What the popup's Clear does. The page is already open; nothing will reload it.
  await fakeBrowser.storage.local.remove(pageKey(url));
  await wait(10);

  expect(document.querySelector('.clr')!.textContent, 'the text edit should be undone').toBe(
    'Original',
  );
  expect(document.querySelector('style[data-tweakpage-style]'), 'and the styles taken back out').toBeNull();
  expect(document.getElementById('tweakpage-marker')).toBeNull();
});

test("a site rewrite becomes the new baseline, so clearing restores the site's value", async () => {
  const url = 'https://example.com/live';
  // Its own element and selector: engines from earlier tests keep observing this
  // document, and sharing .title with them lets their reapply race this test's.
  document.body.innerHTML = '<h1 class="live">Original</h1>';
  await seed(url, [record({ id: 'live1', selector: '.live', oldValue: 'Original', newValue: 'Edited headline' })]);
  const engine = new ApplierEngine(document);
  await engine.start(url);
  expect(document.querySelector('.live')!.textContent).toBe('Edited headline');

  // The site updates the same text — a price, a stock count. We reapply on top of it,
  // but what the user would get back on reset must be this, not the stale snapshot
  // (review 2026-08-17, finding 3).
  document.querySelector('.live')!.textContent = 'Live price update';
  await wait(80);
  expect(document.querySelector('.live')!.textContent, 'the edit stays applied').toBe(
    'Edited headline',
  );

  await fakeBrowser.storage.local.remove(pageKey(url));
  await wait(10);
  expect(document.querySelector('.live')!.textContent, "reset restores the site's latest").toBe(
    'Live price update',
  );
});

test('the marker yields while the editor UI is on screen and returns when it closes', async () => {
  const url = 'https://example.com/marker';
  document.body.innerHTML = '<h1 class="mk">Original</h1>';
  await seed(url, [record({ selector: '.mk' })]);
  const engine = new ApplierEngine(document);
  await engine.start(url);
  expect(document.getElementById('tweakpage-marker'), 'alone, the applier says it').toBeTruthy();

  // The panel opens: its footer already carries the count.
  document.dispatchEvent(new CustomEvent('tweakpage:ui', { detail: { state: 'open', shared: false, count: 1 } }));
  expect(document.getElementById('tweakpage-marker'), 'two voices, same sentence').toBeNull();

  // Minimized: the chip is the way back in, even before anything is edited.
  document.dispatchEvent(new CustomEvent('tweakpage:ui', { detail: { state: 'minimized', shared: false, count: 0 } }));
  expect(document.getElementById('tweakpage-marker'), 'minimized keeps the chip').toBeTruthy();

  document.dispatchEvent(new CustomEvent('tweakpage:ui', { detail: { state: 'closed', shared: false, count: 1 } }));
  expect(document.getElementById('tweakpage-marker')).toBeTruthy();
});

test('inline editing pauses reapply so typing is not overwritten', async () => {
  const url = 'https://example.com/typing';
  document.body.innerHTML = '<h1 class="ty">Original</h1>';
  await seed(url, [record({ selector: '.ty', oldValue: 'Original', newValue: 'Edited' })]);
  const engine = new ApplierEngine(document);
  await engine.start(url);
  expect(document.querySelector('.ty')!.textContent).toBe('Edited');

  document.dispatchEvent(new CustomEvent('tweakpage:editing', { detail: { on: true } }));
  // The user types: every keystroke is a mutation the observer sees.
  document.querySelector('.ty')!.textContent = 'Edited plus my typing';
  await wait(80);
  expect(document.querySelector('.ty')!.textContent, 'the applier must not eat keystrokes').toBe(
    'Edited plus my typing',
  );

  document.dispatchEvent(new CustomEvent('tweakpage:editing', { detail: { on: false } }));
  await wait(10);
  expect(document.querySelector('.ty')!.textContent, 'released, records apply again').toBe('Edited');
});

test("a record's baseline is never taken from another record's element", async () => {
  // The corruption behind the wizard report. Two steps of the same wizard mint the same
  // selector, so both records name one element on any given screen. refreshBaselines
  // exists to follow a site that rewrites a value it does not own — but it resolved the
  // first step's record onto the second step's element and wrote that element's words
  // into oldValue. oldValue is what Clear and undo put back, so this loaded the page
  // with somebody else's text and the export showed a fingerprint and an oldValue that
  // could not both be true.
  document.body.innerHTML = '<div class="opts"><span>Second question</span></div>';
  const first = record({
    id: 'first', selector: '.opts > span', textFingerprint: 'First question',
    oldValue: 'First question', newValue: 'First question JACK',
  });
  const second = record({
    id: 'second', selector: '.opts > span', textFingerprint: 'Second question',
    oldValue: 'Second question', newValue: 'Second question JACK',
  });
  await seed('https://a.com/wizard', [first, second]);

  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/wizard');
  await wait(50);
  expect(document.querySelector('.opts > span')!.textContent).toBe('Second question JACK');

  // The damage lands on the pass after the first: by then the element holds what the
  // second record wrote, and that is exactly what made the first record believe it.
  document.body.appendChild(document.createElement('hr'));
  await wait(200);
  expect(document.querySelector('.opts > span')!.textContent).toBe('Second question JACK');
  const stored = (await fakeBrowser.storage.local.get(pageKey('https://a.com/wizard')))[
    pageKey('https://a.com/wizard')
  ] as { records: EditRecord[] };
  const byId = Object.fromEntries(stored.records.map((r) => [r.id, r]));
  expect(byId.first!.oldValue, 'the step it belongs to').toBe('First question');
  expect(byId.second!.oldValue).toBe('Second question');
});
