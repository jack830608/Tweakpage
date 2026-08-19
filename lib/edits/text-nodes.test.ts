import { beforeEach, describe, expect, test } from 'vitest';
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

describe('a run emptied by an edit', () => {
  test('keeps its number, so the run after it keeps its own', () => {
    // Numbered only among visible runs, an emptied run stopped counting and the next
    // one inherited its number. The edit then wrote onto that one too.
    document.body.innerHTML = '<h1 id="h">Hello <span>big</span> world</h1>';
    const el = document.getElementById('h')!;
    const before = textRuns(el).map((r) => r.index);
    const middle = textNodeAt(el, before[1]!)!;
    middle.nodeValue = '';
    const after = textRuns(el);
    expect(after.map((r) => r.index), 'the survivors keep the numbers they had').toEqual([
      before[0],
      before[2],
    ]);
    expect(textNodeAt(el, before[2]!)?.nodeValue, 'and still resolve to themselves').toBe(' world');
    expect(textNodeAt(el, before[1]!), 'the emptied one is simply not there').toBeNull();
  });

  test('and an ordinary element still numbers its runs from the start', () => {
    document.body.innerHTML = '<p id="p">One <b>two</b> three</p>';
    const runs = textRuns(document.getElementById('p')!);
    expect(runs).toHaveLength(3);
    expect(runs.map((r) => r.node.nodeValue)).toEqual(['One ', 'two', ' three']);
    for (const run of runs) {
      expect(textNodeAt(document.getElementById('p')!, run.index)).toBe(run.node);
    }
  });
});
