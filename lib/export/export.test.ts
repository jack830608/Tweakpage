import { expect, test } from 'vitest';
import { exportFilename, toJson } from './json';
import { toMarkdown } from './markdown';
import type { EditRecord, PageEdits } from '../edits/types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1', selector: '.hero-title', fallbackSelectors: [],
    elementLabel: 'h2.hero-title "Unleash Your Sound"',
    type: 'style', property: 'color', oldValue: '#333333', newValue: '#ff0000',
    enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

const page: PageEdits = {
  version: 1,
  url: 'https://example.com/products/spark',
  title: 'Spark',
  updatedAt: '2026-08-15T10:00:00.000Z',
  records: [
    record({}),
    record({ id: 'r2', property: 'fontSize', oldValue: '32px', newValue: '40px' }),
    record({
      id: 'r3', type: 'text', property: 'textContent',
      oldValue: 'Unleash Your Sound', newValue: 'Unleash Your Tone',
    }),
    record({
      id: 'r4', selector: '.hero img', elementLabel: 'img.hero-img',
      type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png',
    }),
  ],
};

test('toJson round-trips and keeps the schema version', () => {
  const parsed = JSON.parse(toJson(page)) as PageEdits;
  expect(parsed).toEqual(page);
  expect(parsed.version).toBe(1);
});

test('exportFilename uses hostname and date', () => {
  expect(exportFilename('https://example.com/products/spark', '20260815')).toBe(
    'tweakpage-example.com-20260815.json',
  );
});

test('toMarkdown groups records by element and formats each kind', () => {
  const md = toMarkdown(page, '2026-08-15');
  expect(md).toBe(
    [
      '# Page edits — https://example.com/products/spark',
      'Exported 2026-08-15 by Tweakpage',
      '',
      '## h2.hero-title "Unleash Your Sound"',
      '',
      '- Selector: `.hero-title`',
      '',
      '- color: `#333333` → `#ff0000`',
      '- font-size: `32px` → `40px`',
      '- text: `Unleash Your Sound` → `Unleash Your Tone`',
      '',
      '## img.hero-img',
      '',
      '- Selector: `.hero img`',
      '',
      '- src: `/a.png` → `/b.png`',
      '',
    ].join('\n'),
  );
});
