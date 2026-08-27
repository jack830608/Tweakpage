import { expect, test } from 'vitest';
import { forHandOff } from './hand-off';
import { toMarkdown } from './markdown';
import { toJson } from './json';
import type { EditRecord, PageEdits } from '../edits/types';

const record = (overrides: Partial<EditRecord>): EditRecord => ({
  id: 'r1', selector: '.hero', fallbackSelectors: [], elementLabel: 'p.hero',
  type: 'style', property: 'color', oldValue: '#000000', newValue: '#ff0000',
  enabled: true, createdAt: 'n', updatedAt: 'n',
  ...overrides,
});

const page = (): PageEdits => ({
  version: 1, url: 'https://example.com/p', title: 'T', updatedAt: 'n',
  records: [
    record({ id: 'off', enabled: false, newValue: '#0ff000' }),
    record({ id: 'on' }),
  ],
});

/**
 * Switching a change off is deciding against it. It stayed in the summary anyway, with
 * nothing marking it as off, so an engineer received work nobody had asked for mixed in
 * with work they had.
 */
test('a hand-off carries only the changes that are switched on', () => {
  const md = toMarkdown(forHandOff(page()), 'today');
  expect(md, 'the change that was switched off').not.toContain('#0ff000');
  expect(md, 'the change that was left on').toContain('#ff0000');
});

/**
 * The other direction, and the reason this is a separate function rather than a filter
 * inside toMarkdown: a JSON export is how the work moves between your own machines, and
 * dropping what you had switched off would be losing it.
 */
test('an export of your own work keeps what you switched off', () => {
  const exported = JSON.parse(toJson(page())) as PageEdits;
  expect(exported.records.map((r) => r.id)).toEqual(['off', 'on']);
  expect(exported.records.find((r) => r.id === 'off')!.enabled).toBe(false);
});
