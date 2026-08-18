import { expect, test } from 'vitest';
import { toMarkdown } from './markdown';
import type { EditRecord, PageEdits } from '../edits/types';

test('a note rides under its change, turning the list into a brief', () => {
  const page: PageEdits = {
    version: 1, url: 'https://a.com/p', title: 'T', updatedAt: 'n',
    records: [{
      id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
      type: 'text', property: 'textContent', oldValue: 'Old', newValue: 'New',
      note: 'Legal requires this wording',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    }],
  };
  const md = toMarkdown(page, '2026-08-18');
  expect(md).toContain('- text: "Old" → "New"');
  expect(md).toContain('\n  - Legal requires this wording');
});

test('structural changes are named in the hand-off, not omitted', () => {
  const record = (o: Partial<EditRecord>): EditRecord => ({
    id: 'r', selector: '.card', fallbackSelectors: [], elementLabel: 'div.card',
    type: 'style', property: 'color', oldValue: '#000', newValue: '#f00',
    enabled: true, createdAt: 'n', updatedAt: 'n', ...o,
  });
  const md = toMarkdown({
    version: 1, url: 'https://a.com/p', title: 'T', updatedAt: 'n',
    records: [
      record({ id: 'm1', type: 'move', property: 'domIndex', oldValue: '3', newValue: '1' }),
      record({ id: 'c1', type: 'clone', property: 'clone', oldValue: '', newValue: '' }),
    ],
  }, '2026-08-18');
  // An engineer reading this list has to be told the section moved and was duplicated;
  // silence reads as "nothing to build".
  expect(md).toMatch(/position 4 .* position 2|moved/i);
  expect(md).toMatch(/duplicat|copy/i);
});
