import { expect, test } from 'vitest';
import { clampPosition } from './useDraggable';

const size = { width: 320, height: 400 };
const viewport = { width: 1280, height: 800 };

test('clampPosition keeps the panel inside the viewport', () => {
  expect(clampPosition({ x: -50, y: -20 }, size, viewport)).toEqual({ x: 0, y: 0 });
  expect(clampPosition({ x: 2000, y: 900 }, size, viewport)).toEqual({ x: 960, y: 400 });
  expect(clampPosition({ x: 100, y: 200 }, size, viewport)).toEqual({ x: 100, y: 200 });
});

test('clampPosition pins to the top-left when the panel exceeds the viewport', () => {
  expect(clampPosition({ x: 50, y: 50 }, { width: 1400, height: 900 }, viewport)).toEqual({ x: 0, y: 0 });
});
