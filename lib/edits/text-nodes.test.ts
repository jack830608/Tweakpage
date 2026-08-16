import { beforeEach, expect, test } from 'vitest';
import { hasInlineMarkup, textNodeAt, textNodeIndex, textNodeProperty, textRuns } from './text-nodes';

beforeEach(() => {
  document.body.innerHTML = '';
});

test('splits an element into its visible text runs', () => {
  document.body.innerHTML = '<h1 id="t">Make the page <span>yours</span></h1>';
  const runs = textRuns(document.getElementById('t')!);
  expect(runs.map((r) => r.node.nodeValue)).toEqual(['Make the page ', 'yours']);
  expect(runs.map((r) => r.label)).toEqual(['h1', 'span']);
});

test('ignores whitespace-only nodes so formatting does not create fields', () => {
  document.body.innerHTML = '<p id="t">\n  <strong>Bold</strong>\n  tail\n</p>';
  expect(textRuns(document.getElementById('t')!).map((r) => r.node.nodeValue?.trim())).toEqual([
    'Bold',
    'tail',
  ]);
});

test('labels nested runs by their path', () => {
  document.body.innerHTML = '<p id="t">a <a href="#"><em>deep</em></a></p>';
  expect(textRuns(document.getElementById('t')!)[1].label).toBe('a > em');
});

test('resolves a run again from the element alone', () => {
  document.body.innerHTML = '<h1 id="t">One <b>two</b></h1>';
  const el = document.getElementById('t')!;
  expect(textNodeAt(el, 1)?.nodeValue).toBe('two');
  expect(textNodeAt(el, 5)).toBeNull();
});

test('only elements with markup and several runs need per-run editing', () => {
  document.body.innerHTML = '<h1 id="plain">Just text</h1><h1 id="mixed">a <b>b</b></h1>';
  expect(hasInlineMarkup(document.getElementById('plain')!)).toBe(false);
  expect(hasInlineMarkup(document.getElementById('mixed')!)).toBe(true);
});

test('property round-trips through its addressed form', () => {
  expect(textNodeIndex(textNodeProperty(3))).toBe(3);
  expect(textNodeIndex('textContent')).toBeNull();
  expect(textNodeIndex('textNode:nope')).toBeNull();
});
