import { expect, test } from 'vitest';
import { alphaPercent, hexWithoutAlpha, isTransparent, pxToNumber, rgbToHex, withAlphaPercent } from './css-values';

test('rgbToHex parses rgb() and rgba()', () => {
  expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
  expect(rgbToHex('rgba(17, 34, 51, 0.5)'), 'alpha is kept, not dropped').toBe('#11223380');
});

test('rgbToHex normalizes hex forms', () => {
  expect(rgbToHex('#A1B2C3')).toBe('#a1b2c3');
  expect(rgbToHex('#abc')).toBe('#aabbcc');
});

test('rgbToHex falls back to black for unparseable values', () => {
  expect(rgbToHex('transparent')).toBe('#000000');
  expect(rgbToHex('var(--brand)')).toBe('#000000');
});

test('pxToNumber parses and rounds px values', () => {
  expect(pxToNumber('32px')).toBe(32);
  expect(pxToNumber('19.2px')).toBe(19);
  expect(pxToNumber('normal')).toBe(0);
  expect(pxToNumber('')).toBe(0);
});

test('isTransparent detects unset backgrounds', () => {
  expect(isTransparent('rgba(0, 0, 0, 0)')).toBe(true);
  expect(isTransparent('transparent')).toBe(true);
  expect(isTransparent('')).toBe(true);
  expect(isTransparent('rgb(255, 0, 0)')).toBe(false);
  expect(isTransparent('rgba(255, 0, 0, 0.5)')).toBe(false);
});

test('rgbToHex keeps alpha as an 8-digit hex', () => {
  expect(rgbToHex('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
  expect(rgbToHex('rgba(255, 0, 0, 1)')).toBe('#ff0000');
  expect(rgbToHex('rgb(255 0 0 / 0.25)')).toBe('#ff000040');
  expect(rgbToHex('#00ff0080')).toBe('#00ff0080');
});

test('alpha helpers split and rebuild the value', () => {
  expect(hexWithoutAlpha('#11223344')).toBe('#112233');
  expect(hexWithoutAlpha('#112233')).toBe('#112233');
  expect(alphaPercent('#11223380')).toBe(50);
  expect(alphaPercent('#112233')).toBe(100);
  expect(withAlphaPercent('#112233', 50)).toBe('#11223380');
  expect(withAlphaPercent('#11223380', 100)).toBe('#112233');
});
