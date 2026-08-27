import { beforeEach, describe, expect, test, vi } from 'vitest';
import { applyDomEdit, revertDomEdit } from './dom';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('an attribute the element never had', () => {
  const record = (overrides = {}) => ({
    id: 'a1', selector: 'a', fallbackSelectors: [], elementLabel: 'a',
    type: 'attr' as const, property: 'href', oldValue: '', newValue: '/go',
    enabled: true, createdAt: 'n', updatedAt: 'n',
    ...overrides,
  });

  test('reset restores absence, not an empty attribute', () => {
    // href="" is not "no href": it turns an inert element into a link to the current
    // page and changes its keyboard and screen-reader semantics (review finding 8).
    document.body.innerHTML = '<a id="cta">Disabled CTA</a>';
    const el = document.getElementById('cta')!;
    applyDomEdit(el, record({ absent: true }));
    expect(el.getAttribute('href')).toBe('/go');

    revertDomEdit(el, record({ absent: true }));
    expect(el.hasAttribute('href')).toBe(false);
  });

  test('an attribute that did exist still reverts to its value', () => {
    document.body.innerHTML = '<a id="cta" href="/old">CTA</a>';
    const el = document.getElementById('cta')!;
    applyDomEdit(el, record({ oldValue: '/old' }));
    revertDomEdit(el, record({ oldValue: '/old' }));
    expect(el.getAttribute('href')).toBe('/old');
  });
});

describe('moving an element among its siblings', () => {
  const move = (oldValue: string, newValue: string) => ({
    id: 'm1', selector: '#b', fallbackSelectors: [], elementLabel: 'p#b',
    type: 'move' as const, property: 'domIndex', oldValue, newValue,
    enabled: true, createdAt: 'n', updatedAt: 'n',
  });
  const order = () => [...document.querySelectorAll('p')].map((p) => p.id).join('');

  beforeEach(() => {
    document.body.innerHTML = '<div><p id="a">A</p><p id="b">B</p><p id="c">C</p></div>';
  });

  test('apply places the element at its new index, revert puts it back', () => {
    const el = document.getElementById('b')!;
    applyDomEdit(el, move('1', '0'));
    expect(order()).toBe('bac');
    revertDomEdit(el, move('1', '0'));
    expect(order()).toBe('abc');
  });

  test('moving down works too', () => {
    applyDomEdit(document.getElementById('b')!, move('1', '2'));
    expect(order()).toBe('acb');
  });

  test('an element already in place is left alone', () => {
    // The reapply loop runs on every page mutation, our own moves included. A move that
    // re-inserts an already-placed node would fire the observer forever.
    const el = document.getElementById('b')!;
    applyDomEdit(el, move('1', '0'));
    const inserts = vi.spyOn(el.parentElement!, 'insertBefore');
    applyDomEdit(el, move('1', '0'));
    expect(inserts).not.toHaveBeenCalled();
  });

  test("tweakpage's own injected nodes never count as siblings", () => {
    // The marker and host live in the page too; letting them shift indices would make
    // the same record mean different positions with the editor open and closed.
    document.body.innerHTML =
      '<div><div id="tweakpage-marker"></div><p id="a">A</p><p id="b">B</p></div>';
    const el = document.getElementById('b')!;
    applyDomEdit(el, move('1', '0'));
    expect(order()).toBe('ba');
    expect(document.querySelector('div div')!.id, 'marker stays where it was').toBe('tweakpage-marker');
  });
});

describe('duplicating an element', () => {
  const clone = (overrides = {}) => ({
    id: 'cl1', selector: '#card', fallbackSelectors: [], elementLabel: 'div#card',
    type: 'clone' as const, property: 'clone', oldValue: '', newValue: '',
    enabled: true, createdAt: 'n', updatedAt: 'n',
    ...overrides,
  });

  beforeEach(() => {
    document.body.innerHTML =
      '<div><div id="card" data-tweakpage="st9"><h3 id="inner">Card</h3><p>Body</p></div><div id="next">Next</div></div>';
  });

  test('apply inserts a stamped copy right after the source', () => {
    const el = document.getElementById('card')!;
    applyDomEdit(el, clone());
    const copy = document.querySelector('[data-tweakpage-clone="cl1"]')!;
    expect(copy).toBeTruthy();
    expect(copy.previousElementSibling, 'the copy sits next to its source').toBe(el);
    expect(copy.querySelector('h3')?.textContent).toBe('Card');
  });

  test('the copy sheds ids and marks — they belong to the original', () => {
    // A copied id breaks uniqueness for every record that resolves the ORIGINAL by it,
    // and a copied mark would style two elements under one record.
    applyDomEdit(document.getElementById('card')!, clone());
    const copy = document.querySelector('[data-tweakpage-clone="cl1"]')!;
    expect(copy.hasAttribute('id')).toBe(false);
    expect(copy.hasAttribute('data-tweakpage')).toBe(false);
    expect(copy.querySelector('h3')?.hasAttribute('id')).toBe(false);
    expect(document.querySelectorAll('#card')).toHaveLength(1);
  });

  test('reapply is a no-op while the copy exists', () => {
    const el = document.getElementById('card')!;
    applyDomEdit(el, clone());
    applyDomEdit(el, clone());
    expect(document.querySelectorAll('[data-tweakpage-clone="cl1"]'), 'one clone per record').toHaveLength(1);
  });

  test('revert removes the copy and only the copy', () => {
    const el = document.getElementById('card')!;
    applyDomEdit(el, clone());
    revertDomEdit(el, clone());
    expect(document.querySelector('[data-tweakpage-clone="cl1"]')).toBeNull();
    expect(document.getElementById('card'), 'the original stays').toBeTruthy();
  });

  test('a nested clone stamp is scrubbed too, so cloning a clone stays sane', () => {
    applyDomEdit(document.getElementById('card')!, clone());
    const copy = document.querySelector('[data-tweakpage-clone="cl1"]') as Element;
    applyDomEdit(copy, clone({ id: 'cl2', selector: '[data-tweakpage-clone="cl1"]' }));
    expect(document.querySelectorAll('[data-tweakpage-clone="cl1"]'), 'stamps are not inherited').toHaveLength(1);
    expect(document.querySelectorAll('[data-tweakpage-clone="cl2"]')).toHaveLength(1);
  });
});

describe('a move index the page cannot satisfy', () => {
  const move = (newValue: string) => ({
    id: 'm1', selector: '#b', fallbackSelectors: [], elementLabel: 'b',
    type: 'move' as const, property: 'domIndex', oldValue: '1', newValue,
    enabled: true, createdAt: 'n', updatedAt: 'n',
  });

  /**
   * A record can outlive the arrangement it was measured in: siblings get removed, or a
   * share arrives from a page with more of them. The index then points past the end.
   *
   * Landing at the end is the right answer. Landing there and still believing the element
   * belongs somewhere further along is not: the applier reapplies on every mutation, so a
   * write that never reaches its own target is a write that happens forever.
   */
  test('lands at the end, and stays there without writing again', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div><div id="c"></div>';
    const el = document.querySelector('#b')!;

    applyDomEdit(el, move('9'));
    expect(Array.from(document.body.children).map((n) => n.id)).toEqual(['a', 'c', 'b']);

    const writes = vi.fn();
    new MutationObserver(writes).observe(document.body, { childList: true, subtree: true });
    applyDomEdit(el, move('9'));
    applyDomEdit(el, move('9'));

    return new Promise<void>((done) => {
      setTimeout(() => {
        expect(writes).not.toHaveBeenCalled();
        done();
      }, 20);
    });
  });
});
