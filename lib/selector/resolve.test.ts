import { beforeEach, describe, expect, test } from 'vitest';
import { resolveRecord } from './resolve';

beforeEach(() => {
  document.body.innerHTML = '';
});

const rec = (selector: string, fallbackSelectors: string[] = [], textFingerprint?: string) => ({
  selector,
  fallbackSelectors,
  textFingerprint,
});

test('resolves a unique primary selector', () => {
  document.body.innerHTML = '<h1 class="title">Hi</h1>';
  expect(resolveRecord(rec('.title'), document)).toBe(document.querySelector('.title'));
});

test('rejects a primary selector matching multiple elements', () => {
  document.body.innerHTML = '<p class="x">a</p><p class="x">b</p>';
  expect(resolveRecord(rec('.x'), document)).toBeNull();
});

test('falls back when the primary matches nothing', () => {
  document.body.innerHTML = '<div><span class="new-name">Hello</span></div>';
  const el = document.querySelector('span')!;
  expect(resolveRecord(rec('.old-name', ['html > body > div:nth-child(1) > span:nth-child(1)']), document)).toBe(el);
});

test('survives an invalid stored selector', () => {
  document.body.innerHTML = '<em>x</em>';
  expect(resolveRecord(rec('div[[', ['html > body > em:nth-child(1)']), document)).toBe(
    document.querySelector('em'),
  );
});

test('uses the text fingerprint as last resort when unique', () => {
  document.body.innerHTML = '<h2>Alpha</h2><h2>Beta</h2>';
  const el = document.querySelectorAll('h2')[1];
  expect(resolveRecord(rec('h2.gone', [], 'Beta'), document)).toBe(el);
});

test('rejects an ambiguous fingerprint', () => {
  document.body.innerHTML = '<h2>Same</h2><h2>Same</h2>';
  expect(resolveRecord(rec('h2.gone', [], 'Same'), document)).toBeNull();
});

test('returns null when everything misses', () => {
  document.body.innerHTML = '<p>text</p>';
  expect(resolveRecord(rec('.nope', ['.also-nope'], 'missing'), document)).toBeNull();
});

test('fingerprint scan is restricted to the same tag (derived from fallbacks)', () => {
  document.body.innerHTML = '<div><span class="was-renamed">Beta</span></div>';
  const el = document.querySelector('span')!;
  const record = rec('.gone', ['html > body > div:nth-child(9) > span:nth-child(1)'], 'Beta');
  expect(resolveRecord(record, document)).toBe(el);
});

test('skips the fingerprint scan when no tag can be derived', () => {
  document.body.innerHTML = '<p>Gamma</p>';
  expect(resolveRecord(rec('.gone', ['[data-x="y"]'], 'Gamma'), document)).toBeNull();
});

describe('identity guard: a unique selector hit still has to be the remembered element', () => {
  const record = (overrides = {}) => ({
    selector: 'p:nth-of-type(2)',
    fallbackSelectors: [],
    textFingerprint: 'Target offer',
    type: 'text' as const,
    property: 'textContent',
    oldValue: 'Target offer',
    newValue: 'Edited target',
    ...overrides,
  });

  test('a sibling inserted above the target relocates the record instead of hitting the neighbour', () => {
    // The reviewer's repro: the selector is structural, the site rerendered, and
    // p:nth-of-type(2) now names an element the user never picked.
    document.body.innerHTML = '<div><p>Inserted offer</p><p>First offer</p><p>Target offer</p></div>';
    const el = resolveRecord(record(), document);
    expect(el?.textContent).toBe('Target offer');
  });

  test('the applied state counts as identity too', () => {
    // After we apply, the element shows newValue, not the fingerprint. That must not
    // read as drift.
    document.body.innerHTML = '<div><p>First offer</p><p>Edited target</p></div>';
    const el = resolveRecord(record(), document);
    expect(el?.textContent).toBe('Edited target');
  });

  test('drift is caught even while the edit is applied', () => {
    // The sibling arrived without the site discarding our applied edit.
    document.body.innerHTML =
      '<div><p>Inserted offer</p><p>First offer</p><p>Edited target</p></div>';
    const el = resolveRecord(record(), document);
    expect(el?.textContent).toBe('Edited target');
  });

  test('a site rewriting the text in place is not drift — the hit is trusted', () => {
    // Dynamic content: the price element is still the same element, its text just moved
    // on. Refusing the hit here would stop edits from replaying on any live page.
    document.body.innerHTML = '<div><p>First offer</p><p>Live price update</p></div>';
    const el = resolveRecord(record(), document);
    expect(el?.textContent).toBe('Live price update');
  });

  test('with no fingerprint the selector is all there is, as before', () => {
    document.body.innerHTML = '<div><p>One</p><p>Two</p></div>';
    const el = resolveRecord(record({ textFingerprint: undefined }), document);
    expect(el?.textContent).toBe('Two');
  });

  test('an ambiguous relocation falls back to the selector hit', () => {
    // Two elements carry the remembered text; picking either would be a guess.
    document.body.innerHTML =
      '<div><p>Inserted</p><p>Other</p><p>Target offer</p><p>Target offer</p></div>';
    const el = resolveRecord(record(), document);
    expect(el?.textContent).toBe('Other');
  });
});
