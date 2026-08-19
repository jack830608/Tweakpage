import { describe, expect, test } from 'vitest';
import { parseImport } from './import';

const wrap = (record: Record<string, unknown>) =>
  JSON.stringify({
    version: 1,
    url: 'https://a.com/p',
    title: 'T',
    updatedAt: 'n',
    records: [
      {
        id: 'r1',
        selector: '.t',
        fallbackSelectors: [],
        elementLabel: 'a',
        enabled: true,
        createdAt: 'n',
        updatedAt: 'n',
        ...record,
      },
    ],
  });
const accepted = (record: Record<string, unknown>) => {
  const parsed = parseImport(wrap(record));
  return parsed.ok && parsed.page.records.length === 1;
};

describe('a link somebody else wrote', () => {
  test('cannot smuggle a script url past the scheme check', () => {
    // The check is a substring test; the URL parser strips TAB, LF and CR before it
    // reads the scheme, so these three are all javascript: by the time they are used.
    for (const value of ['java\tscript:alert(1)', 'java\nscript:alert(1)', 'java\rscript:alert(1)', ' javascript:alert(1)', 'JaVaScRiPt:alert(1)']) {
      expect(accepted({ type: 'attr', property: 'href', oldValue: '/', newValue: value }), JSON.stringify(value)).toBe(false);
    }
  });

  test('cannot hide one in oldValue, which is what a revert writes back', () => {
    // Flipping to the Original preview writes oldValue into the page. It was never
    // checked at all — the first thing the recipient of a shared preview does.
    expect(accepted({ type: 'attr', property: 'href', oldValue: 'javascript:alert(1)', newValue: '/ok' })).toBe(false);
    expect(accepted({ type: 'attr', property: 'src', oldValue: 'java\tscript:alert(1)', newValue: '/ok.png' })).toBe(false);
  });

  test('cannot close our rule and open its own', () => {
    // Typed in the panel a value can never contain a semicolon, because the parser
    // splits on it. Imported, it could — and one record then owns the whole rule.
    const attack = 'url(https://evil.tld/beacon); position: fixed; inset: 0; z-index: 2147483647';
    expect(accepted({ type: 'style', property: 'background-image', oldValue: 'none', newValue: attack })).toBe(false);
    // A value that opens a bracket we cannot close is not a value we understand.
    expect(accepted({ type: 'style', property: 'mask-image', oldValue: 'none', newValue: 'url(java\tscript:x' })).toBe(false);
    expect(accepted({ type: 'style', property: 'content', oldValue: 'none', newValue: 'attr(data-secret)' })).toBe(false);
  });

  test('but may still point at a picture, the way the panel always could', () => {
    // The panel's own background-image field has always accepted an http(s) or inline
    // image, so refusing the same shape from a colleague's export would be a rule that
    // exists only against people you already trusted enough to open a link from.
    expect(accepted({ type: 'style', property: 'mask-image', oldValue: 'none', newValue: 'url(https://cdn.example.com/m.png)' })).toBe(true);
    expect(accepted({ type: 'style', property: 'cursor', oldValue: 'auto', newValue: 'url(https://cdn.example.com/c.png), auto' })).toBe(true);
    expect(accepted({ type: 'style', property: 'mask-image', oldValue: 'none', newValue: 'url(ftp://evil.tld/x)' })).toBe(false);
  });

  test('and an ordinary edit still arrives', () => {
    expect(accepted({ type: 'attr', property: 'href', oldValue: '/a', newValue: '/b' })).toBe(true);
    expect(accepted({ type: 'style', property: 'color', oldValue: 'red', newValue: 'blue' })).toBe(true);
    expect(accepted({ type: 'style', property: 'aspect-ratio', oldValue: 'auto', newValue: '16 / 9' })).toBe(true);
  });
});
