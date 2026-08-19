import { beforeEach, describe, expect, test } from 'vitest';
import { generateSelector } from './generate';
import { resolveRecord } from './resolve';
import { similarSelector } from './similar';
import { buildContext } from './context';
import { toMarkdown } from '../export/markdown';
import type { EditRecord, PageEdits } from '../edits/types';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('review 1: an edit that is not text', () => {
  test('does not land on a stranger when the words say it should not', () => {
    // Three buttons, two of them saying the same thing. Pick the second Save, then let
    // the site insert one above: the positional selector now names "One", and the
    // remembered word is on two elements so following the text cannot choose. A text
    // record refuses. A style record used to take the positional hit and recolour a
    // button the user never touched.
    document.body.innerHTML =
      '<div id="bar"><button>One</button><button>Save</button><button>Save</button></div>';
    const target = document.querySelectorAll('#bar button')[1]!;
    const gen = generateSelector(target);

    document.getElementById('bar')!.insertAdjacentHTML('afterbegin', '<button>Inserted</button>');

    const asText = { ...gen, type: 'text' as const, property: 'textContent', newValue: 'x' };
    expect(resolveRecord(asText, document), 'text already refuses').toBeNull();

    const asStyle = { ...gen, type: 'style' as const, property: 'color', newValue: 'red' };
    expect(resolveRecord(asStyle, document), 'and so must everything else').toBeNull();
  });

  test('but a live page rewriting its own words still replays', () => {
    // The reason the gate was narrow in the first place. The price element is the same
    // element; its words simply moved on, and they are nowhere else on the page. There
    // is nothing to be confused with, so the hit stands.
    document.body.innerHTML = '<div id="bar"><span class="price">$39</span></div>';
    const gen = generateSelector(document.querySelector('.price')!);
    document.querySelector('.price')!.textContent = '$42';
    const asStyle = { ...gen, type: 'style' as const, property: 'color', newValue: 'red' };
    expect(resolveRecord(asStyle, document)?.textContent).toBe('$42');
  });
});

describe('review 3: the hand-off groups by what it can see', () => {
  test('two elements with the same label are two elements', () => {
    // elementLabel is for reading, not for telling elements apart. Grouped by it, a
    // dialog's Save and a toolbar's Save became one heading carrying one selector, and
    // the second change looked like it belonged to the first element.
    const record = (id: string, selector: string, newValue: string): EditRecord => ({
      id,
      selector,
      fallbackSelectors: [],
      elementLabel: 'button "Save"',
      type: 'style',
      property: 'color',
      oldValue: 'rgb(0, 0, 0)',
      newValue,
      enabled: true,
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-19T10:00:00.000Z',
    });
    const page: PageEdits = {
      version: 1,
      url: 'https://a.com/p',
      title: 'T',
      updatedAt: '2026-08-19T10:00:00.000Z',
      records: [record('a', '#dialog-save', '#ff0000'), record('b', '#toolbar-save', '#00ff00')],
    };
    const md = toMarkdown(page, '2026-08-19');
    expect(md, 'both selectors reach the reader').toContain('#toolbar-save');
    expect(md.match(/^## /gm), 'one block per element, not per label').toHaveLength(2);
  });
});

describe('review 4: apply to similar', () => {
  test('does not offer a family it cannot name', () => {
    // A Tailwind variant carries a colon, which is not a selector until it is escaped.
    // Unescaped it threw, the throw was swallowed, and the offer degraded to every
    // button on the page — including one with nothing in common.
    document.body.innerHTML =
      '<button class="hover:block">A</button><button class="hover:block">B</button>' +
      '<button class="unrelated">C</button>';
    const set = similarSelector(document.querySelector('button')!);
    expect(set?.count, 'the two that are alike, not all three').toBe(2);
    expect(document.querySelectorAll(set!.selector)).toHaveLength(2);
  });

  test('and still finds an ordinary family', () => {
    document.body.innerHTML =
      '<button class="card-cta">A</button><button class="card-cta">B</button>' +
      '<button class="other">C</button>';
    expect(similarSelector(document.querySelector('button')!)?.count).toBe(2);
  });
});

describe('review 6: an id a browser will accept', () => {
  test('a leading digit is a legal id and must survive as a selector', () => {
    document.body.innerHTML = '<div id="123abc"><p>One</p><p>Two</p></div>';
    const gen = generateSelector(document.getElementById('123abc')!.children[1]!);
    for (const selector of [gen.selector, ...gen.fallbackSelectors]) {
      expect(() => document.querySelector(selector), selector).not.toThrow();
    }
    expect(resolveRecord({ ...gen, type: 'style', property: 'color', newValue: 'red' }, document)?.textContent).toBe('Two');
  });
});

describe('review 7: the heading a reader would name', () => {
  test('includes the heading the element is inside', () => {
    // Selecting the "beta" chip inside a heading: the heading is an ancestor, not an
    // earlier sibling, and looking only backwards walked straight past it.
    document.body.innerHTML = '<main><h2>Checkout <span id="chip">beta</span></h2></main>';
    expect(buildContext(document.getElementById('chip')!)[0]!.heading).toBe('Checkout beta');
  });
});
