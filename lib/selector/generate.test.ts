import { beforeEach, describe, expect, test } from 'vitest';
import { buildElementLabel, generateSelector, nthChildPath } from './generate';

beforeEach(() => {
  document.body.innerHTML = '';
});

test('prefers id selectors', () => {
  document.body.innerHTML = '<div><h1 id="headline">Hello</h1></div>';
  const el = document.getElementById('headline')!;
  const gen = generateSelector(el);
  expect(document.querySelectorAll(gen.selector)).toHaveLength(1);
  expect(gen.selector).toContain('headline');
});

test('never uses hash-like classes', () => {
  document.body.innerHTML =
    '<section><h2 class="css-1x2y3z hero-title">Save 20%</h2><h2 class="css-9zz88x other">Other</h2></section>';
  const el = document.querySelector('.hero-title')!;
  const gen = generateSelector(el);
  expect(gen.selector).not.toContain('css-');
  expect(document.querySelectorAll(gen.selector)).toHaveLength(1);
  expect(document.querySelector(gen.selector)).toBe(el);
});

test('nthChildPath round-trips to the same element', () => {
  document.body.innerHTML = '<div><ul><li>a</li><li>b</li><li>c</li></ul></div>';
  const el = document.querySelectorAll('li')[1];
  const path = nthChildPath(el);
  expect(document.querySelector(path)).toBe(el);
});

test('nthChildPath anchors at the nearest id ancestor', () => {
  document.body.innerHTML = '<div id="root"><p>one</p><p>two</p></div>';
  const el = document.querySelectorAll('p')[1];
  const path = nthChildPath(el);
  expect(path).toBe('#root > p:nth-child(2)');
  expect(document.querySelector(path)).toBe(el);
});

test('includes structural fallback and text fingerprint', () => {
  document.body.innerHTML = '<h2 class="hero-title">Unleash Your Sound</h2>';
  const gen = generateSelector(document.querySelector('h2')!);
  expect(gen.fallbackSelectors.length).toBeGreaterThanOrEqual(1);
  expect(gen.textFingerprint).toBe('Unleash Your Sound');
});

test('caps the text fingerprint at 60 chars', () => {
  document.body.innerHTML = `<p>${'x'.repeat(100)}</p>`;
  const gen = generateSelector(document.querySelector('p')!);
  expect(gen.textFingerprint).toHaveLength(60);
});

test('buildElementLabel uses tag, stable class, and trimmed text', () => {
  document.body.innerHTML =
    '<h2 class="css-1x2y3z hero-title">  Unleash   Your Sound and more and more and more  </h2>';
  expect(buildElementLabel(document.querySelector('h2')!)).toBe(
    'h2.hero-title "Unleash Your Sound and more an"',
  );
});

test('prefers a unique data-* attribute over stable classes', () => {
  document.body.innerHTML =
    '<button class="cta-button" data-testid="buy-now">Buy</button><button class="cta-button">Other</button>';
  const el = document.querySelector('[data-testid="buy-now"]')!;
  const gen = generateSelector(el);
  expect(gen.selector).toBe('[data-testid="buy-now"]');
  expect(document.querySelectorAll(gen.selector)).toHaveLength(1);
});

test('id still wins over data-* attributes', () => {
  document.body.innerHTML = '<div id="hero" data-testid="hero-section">x</div>';
  const gen = generateSelector(document.getElementById('hero')!);
  expect(gen.selector.startsWith('[data-')).toBe(false);
  expect(document.querySelector(gen.selector)).toBe(document.getElementById('hero'));
});

test('skips unstable data-* values (long or digit-heavy)', () => {
  document.body.innerHTML =
    '<p class="lead" data-reactid="12345">a</p><p class="other">b</p>';
  const gen = generateSelector(document.querySelector('.lead')!);
  expect(gen.selector).not.toContain('data-reactid');
});

describe('elements inside a tweakpage copy', () => {
  test('are addressed through the stamp, relative to it', () => {
    // Their absolute selectors describe a page where the copy already exists — which a
    // fresh load is not. Resolved absolutely, they miss, or worse, land on the original.
    document.body.innerHTML =
      '<section class="block"><div class="pg-container"><p>Text</p></div></section>' +
      '<section class="block" data-tweakpage-clone="cl77"><div class="pg-container"><p>Text</p></div></section>';
    const inner = document.querySelectorAll('.pg-container')[1];
    const gen = generateSelector(inner);
    expect(gen.selector.startsWith('[data-tweakpage-clone="cl77"]'), gen.selector).toBe(true);
    expect(document.querySelectorAll(gen.selector), 'unique, and inside the copy').toHaveLength(1);
    expect(document.querySelectorAll(gen.selector)[0]).toBe(inner);
    for (const fallback of gen.fallbackSelectors) {
      expect(fallback.startsWith('[data-tweakpage-clone="cl77"]'), fallback).toBe(true);
    }
  });

  test('the copy root itself still gets the bare stamp', () => {
    document.body.innerHTML = '<div data-tweakpage-clone="cl88"><p>x</p></div>';
    const gen = generateSelector(document.querySelector('[data-tweakpage-clone]')!);
    expect(gen.selector).toBe('[data-tweakpage-clone="cl88"]');
  });
});
