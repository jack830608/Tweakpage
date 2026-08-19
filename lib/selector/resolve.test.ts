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

  test('a unique hit reading somebody else\'s words is refused', () => {
    // This used to be trusted, on the grounds that a price element is still the same
    // element when its text moves on. The cost showed up on a wizard that re-labels one
    // list of buttons at every step: an edit on step one's second option appeared on the
    // second option of every step after it, and went out in the shared link looking like
    // a real proposal. Between a failure that announces itself in the change list and one
    // that quietly puts your words on somebody else's content, take the first.
    document.body.innerHTML = '<div><p>First offer</p><p>Live price update</p></div>';
    expect(resolveRecord(record(), document)).toBeNull();
  });

  test('and only text edits are held to it', () => {
    // The narrowness is the point. Restyling an element whose copy the site rewrites —
    // a price, a counter, a translated string — is ordinary and keeps working; it is
    // rewriting such an element's words that cannot be checked any other way.
    document.body.innerHTML = '<div><p>First offer</p><p>Live price update</p></div>';
    const styled = resolveRecord(
      record({ type: 'style', property: 'color', oldValue: 'red', newValue: 'blue' }),
      document,
    );
    expect(styled?.textContent).toBe('Live price update');
  });

  test('nor a text edit with nothing to be recognised by', () => {
    // No fingerprint means the element had no text when it was picked, or the record
    // predates fingerprints. Those keep trusting the selector, which is all they had.
    document.body.innerHTML = '<div><p>First offer</p><p>Live price update</p></div>';
    const el = resolveRecord(record({ textFingerprint: undefined }), document);
    expect(el?.textContent).toBe('Live price update');
  });

  test('with no fingerprint the selector is all there is, as before', () => {
    document.body.innerHTML = '<div><p>One</p><p>Two</p></div>';
    const el = resolveRecord(record({ textFingerprint: undefined }), document);
    expect(el?.textContent).toBe('Two');
  });

  test('an ambiguous relocation is refused rather than guessed at', () => {
    // Two elements carry the remembered text, so relocating would be a guess — and the
    // selector hit reads "Other", which was never ours, so writing there is a guess too.
    // The difference is that this one would be made silently.
    document.body.innerHTML =
      '<div><p>Inserted</p><p>Other</p><p>Target offer</p><p>Target offer</p></div>';
    expect(resolveRecord(record(), document)).toBeNull();
  });

  test('a style edit is refused too, when the words name more than one element', () => {
    // Written earlier the other way round, on the grounds that only text edits are
    // identified by their words. That is true of what they carry and false of what the
    // page can tell us: the remembered words being on two elements means the page has
    // two candidates, and the positional hit is one of them chosen at random. A colour
    // landing on a button nobody touched is as silent as a caption doing it.
    document.body.innerHTML =
      '<div><p>Inserted</p><p>Other</p><p>Target offer</p><p>Target offer</p></div>';
    expect(resolveRecord(record({ type: 'style', property: 'color' }), document)).toBeNull();
  });

  test('but not when those words have simply left the page', () => {
    // The live-content case the narrow gate was protecting: this element is the same
    // element, its words moved on, and they are nowhere else to be confused with.
    document.body.innerHTML = '<div><p>First offer</p><p>Live price update</p></div>';
    const el = resolveRecord(record({ type: 'style', property: 'color' }), document);
    expect(el?.textContent).toBe('Live price update');
  });
});
