import { beforeEach, expect, test } from 'vitest';
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
