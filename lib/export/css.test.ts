import { expect, test } from 'vitest';
import { toCss } from './css';
import { emptyPageEdits, type EditRecord, type PageEdits } from '../edits/types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1', selector: '.hero h1', fallbackSelectors: [], elementLabel: 'h1.title',
    type: 'style', property: 'fontSize', oldValue: '32px', newValue: '48px',
    enabled: true, createdAt: 'n', updatedAt: 'n',
    ...overrides,
  };
}

function page(records: EditRecord[]): PageEdits {
  return { ...emptyPageEdits('https://example.com/pricing', 'Pricing', 'n'), records };
}

test('groups properties by selector into pasteable rules', () => {
  const css = toCss(page([
    record({}),
    record({ id: 'r2', property: 'color', oldValue: '#111', newValue: '#059669' }),
    record({ id: 'r3', selector: '.cta', elementLabel: 'a.cta', property: 'borderRadius', newValue: '8px' }),
  ]), '2026-08-16');

  expect(css).toContain('.hero h1 {\n  font-size: 48px;\n  color: #059669;\n}');
  expect(css).toContain('.cta {\n  border-radius: 8px;\n}');
  // The marker attribute is an implementation detail of the applier.
  expect(css).not.toContain('data-tweakpage');
});

test('leaves out !important so it can live in a stylesheet', () => {
  expect(toCss(page([record({})]), 'n')).not.toContain('!important');
});

test('text and attribute edits come through as comments, not fake CSS', () => {
  const css = toCss(page([
    record({ id: 'r4', type: 'text', property: 'textContent', oldValue: 'Old', newValue: 'New' }),
    record({ id: 'r5', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' }),
  ]), 'n');
  expect(css).toContain('need a content or markup change');
  expect(css).toContain('"Old" → "New"');
  expect(css).toContain('src: "/a.png" → "/b.png"');
});

test('disabled records are left out', () => {
  expect(toCss(page([record({ enabled: false })]), 'n')).not.toContain('font-size');
});
