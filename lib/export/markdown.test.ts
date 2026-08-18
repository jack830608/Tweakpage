import { expect, test } from 'vitest';
import { toMarkdown } from './markdown';
import type { PageEdits } from '../edits/types';

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
