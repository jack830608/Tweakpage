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
