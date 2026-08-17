import { beforeEach, describe, expect, test } from 'vitest';
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
