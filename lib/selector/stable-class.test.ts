import { expect, test } from 'vitest';
import { isStableClass } from './stable-class';

test('accepts semantic class names', () => {
  expect(isStableClass('hero-title')).toBe(true);
  expect(isStableClass('nav')).toBe(true);
  expect(isStableClass('btn')).toBe(true);
  expect(isStableClass('col-md-6')).toBe(true);
  expect(isStableClass('product_card')).toBe(true);
});

test('rejects framework hash prefixes', () => {
  expect(isStableClass('css-1x2y3z')).toBe(false);
  expect(isStableClass('sc-bdfBwQ')).toBe(false);
  expect(isStableClass('emotion-0')).toBe(false);
  expect(isStableClass('jss42')).toBe(false);
});

test('rejects very short and digit-heavy names', () => {
  expect(isStableClass('x')).toBe(false);
  expect(isStableClass('ab')).toBe(false);
  expect(isStableClass('a12345')).toBe(false);
});

test('rejects hash-like mixed tokens without separators', () => {
  expect(isStableClass('a1b2c3')).toBe(false);
  expect(isStableClass('x9k2mQ')).toBe(false);
});

test('accepts semantic names that merely start with framework letters', () => {
  expect(isStableClass('scroll-container')).toBe(true);
  expect(isStableClass('scrollbar')).toBe(true);
  expect(isStableClass('score-board')).toBe(true);
  expect(isStableClass('emotional-support')).toBe(true);
});

test('accepts simple digit-suffixed semantic names', () => {
  expect(isStableClass('card2')).toBe(true);
  expect(isStableClass('step3')).toBe(true);
  expect(isStableClass('row2')).toBe(true);
});

test('rejects css-modules and bare-underscore hash patterns', () => {
  expect(isStableClass('Button_root__x7K2q')).toBe(false);
  expect(isStableClass('_1a2b3c')).toBe(false);
});

test('accepts semantic names prefixed with underscore', () => {
  expect(isStableClass('_button')).toBe(true);
  expect(isStableClass('_wrapper')).toBe(true);
});
