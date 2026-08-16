import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { EditsController } from './controller';

const NOW = () => '2026-08-16T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML =
    '<a class="btn" id="one">One</a><a class="btn">Two</a><a class="btn">Three</a>';
  history.replaceState({}, '', '/page');
});

function controller() {
  return new EditsController(null, document, NOW);
}

test('an edit starts on the one element it was made on', () => {
  const c = controller();
  c.recordEdit(document.getElementById('one')!, 'style', 'color', 'rgb(0, 0, 0)', '#059669');
  const marked = document.querySelectorAll('[data-tweakpage]');
  expect(marked).toHaveLength(1);
  expect(marked[0].id).toBe('one');
});

test('pointing it at the family styles every one of them', () => {
  const c = controller();
  const one = document.getElementById('one')!;
  c.recordEdit(one, 'style', 'color', 'rgb(0, 0, 0)', '#059669');
  c.setSimilarScope(one, true);

  expect(c.appliesToSimilar(one)).toBe(true);
  expect(document.querySelectorAll('[data-tweakpage]')).toHaveLength(3);
  expect(c.getPage().records[0].scope).toBe('similar');
  expect(c.getStatus(c.getPage().records[0].id)).toBe('applied');
});

test('turning it back off leaves only the original element styled', () => {
  const c = controller();
  const one = document.getElementById('one')!;
  c.recordEdit(one, 'style', 'color', 'rgb(0, 0, 0)', '#059669');
  c.setSimilarScope(one, true);
  c.setSimilarScope(one, false);

  expect(c.appliesToSimilar(one)).toBe(false);
  expect(document.querySelectorAll('[data-tweakpage]')).toHaveLength(1);
});

test('scoping is one undo step', () => {
  const c = controller();
  const one = document.getElementById('one')!;
  c.recordEdit(one, 'style', 'color', 'rgb(0, 0, 0)', '#059669');
  c.setSimilarScope(one, true);
  c.undo();
  expect(c.getPage().records[0].scope ?? 'element').toBe('element');
  expect(document.querySelectorAll('[data-tweakpage]')).toHaveLength(1);
});

test('an edit records the viewport width it was made at', () => {
  const c = controller();
  c.recordEdit(document.getElementById('one')!, 'style', 'color', 'rgb(0, 0, 0)', '#059669');
  expect(c.getPage().records[0].viewport).toBe(window.innerWidth);
});

test('a page with no family offers no scoping', () => {
  document.body.innerHTML = '<h1 id="solo" class="title">Only one</h1>';
  const c = controller();
  expect(c.similarTo(document.getElementById('solo')!)).toBeNull();
});
