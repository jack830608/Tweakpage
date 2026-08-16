import { expect, test } from 'vitest';
import { buildCssText, cssPropertyName } from './css';
import type { EditRecord } from './types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1',
    selector: '.hero',
    fallbackSelectors: [],
    elementLabel: 'h2.hero',
    type: 'style',
    property: 'color',
    oldValue: '#333333',
    newValue: '#ff0000',
    enabled: true,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

test('cssPropertyName converts camelCase to kebab-case', () => {
  expect(cssPropertyName('fontSize')).toBe('font-size');
  expect(cssPropertyName('backgroundColor')).toBe('background-color');
  expect(cssPropertyName('paddingTop')).toBe('padding-top');
  expect(cssPropertyName('color')).toBe('color');
});

test('buildCssText emits one !important rule per enabled style record', () => {
  const css = buildCssText([
    record({}),
    record({ id: 'r2', property: 'fontSize', newValue: '40px' }),
  ]);
  expect(css).toBe(
    '[data-tweakpage~="r1"] { color: #ff0000 !important; }\n' +
      '[data-tweakpage~="r2"] { font-size: 40px !important; }',
  );
});

test('buildCssText skips disabled and non-style records', () => {
  const css = buildCssText([
    record({ enabled: false }),
    record({ id: 'r2', type: 'text', property: 'textContent', newValue: 'Hi' }),
  ]);
  expect(css).toBe('');
});

test('a record id that could break out of the attribute selector is dropped', () => {
  const css = buildCssText([record({ id: 'x"] { } body { display: none' })]);
  expect(css).toBe('');
});
