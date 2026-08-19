import { describe, expect, test } from 'vitest';
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
  expect(md).toContain('- text: `Old` → `New`');
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

describe('a hand-off nobody can break', () => {
  const rec = (over: Partial<EditRecord>): EditRecord => ({
    id: 'r', selector: '.t', fallbackSelectors: [], elementLabel: 'p.t',
    type: 'style', property: 'color', oldValue: 'red', newValue: 'blue',
    enabled: true, createdAt: 'n', updatedAt: 'n', ...over,
  });
  const page = (records: EditRecord[]): PageEdits => ({
    version: 1, url: 'https://a.com/p', title: 'T', updatedAt: 'n', records,
  });

  test('a backtick in a value does not end the code span', () => {
    // Selectors, class names and page copy are not ours to trust: one backtick closes
    // the span early and the rest of the document reads as prose, or as headings.
    const md = toMarkdown(page([rec({ selector: 'a[title="`x`"]', newValue: '`red`' })]), 'today');
    for (const line of md.split('\n').filter((l) => l.includes('`'))) {
      const runs = [...line.matchAll(/`+/g)].map((m) => m[0].length);
      expect(runs.length % 2, `unbalanced: ${line}`).toBe(0);
    }
  });

  test('a newline in a note stays inside its bullet', () => {
    const md = toMarkdown(page([rec({ note: 'first line\n## not a heading' })]), 'today');
    expect(md).not.toMatch(/^## not a heading/m);
  });

  test('a value that starts with a hash cannot open a heading', () => {
    expect(toMarkdown(page([rec({ elementLabel: '# looks like a heading' })]), 'today')).not.toMatch(
      /^# looks like a heading/m,
    );
  });

  test('the locator carries what the JSON knows', () => {
    const md = toMarkdown(
      page([
        rec({
          selector: '#toolbar-save',
          fallbackSelectors: ['main > div:nth-child(2) > button'],
          textFingerprint: 'Save',
          viewport: 1440,
          context: [
            { tag: 'button', classes: ['profile_actions', 'flex'], testId: 'profile-save' },
            { tag: 'section', heading: 'Account settings' },
            { tag: 'main', id: 'settings' },
          ],
        }),
      ]),
      'today',
    );
    for (const expected of [
      '#toolbar-save',
      'main > div:nth-child(2) > button',
      'Save',
      'Account settings',
      'profile_actions',
      'profile-save',
      'main#settings > section > button',
      '1440px',
    ]) {
      expect(md, expected).toContain(expected);
    }
  });

  test('and says nothing about what it does not know', () => {
    const md = toMarkdown(page([rec({})]), 'today');
    for (const absent of ['Region:', 'Component:', 'Test id:', 'Also matches:', 'Seen at:']) {
      expect(md, absent).not.toContain(absent);
    }
  });
});
