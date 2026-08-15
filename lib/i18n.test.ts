import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { t } from './i18n';

const LOCALES = ['en', 'zh_TW'];
const SOURCE_DIRS = ['entrypoints', 'lib'];

function sourceFiles(): string[] {
  return SOURCE_DIRS.flatMap((dir) =>
    (fs.readdirSync(dir, { recursive: true }) as string[])
      .map((name) => path.join(dir, name))
      .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.')),
  );
}

function usedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of sourceFiles()) {
    // `\bt(` so that split('…') and friends don't read as a t() call.
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bt\('([a-z0-9_]+)'/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function localeKeys(locale: string): Set<string> {
  const file = path.join('public/_locales', locale, 'messages.json');
  return new Set(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))));
}

describe('translations', () => {
  test('finds the keys the UI actually asks for', () => {
    const keys = usedKeys();
    expect(keys.size).toBeGreaterThan(20);
    expect(keys).toContain('reset_spacing');
  });

  test.each(LOCALES)('%s has every key the UI uses', (locale) => {
    const available = localeKeys(locale);
    const missing = [...usedKeys()].filter((key) => !available.has(key)).sort();
    expect(missing, `missing from ${locale}/messages.json`).toEqual([]);
  });

  test('the built-in English fallback covers every key too', () => {
    // Content scripts can lose access to chrome.i18n; t() then falls back to this table.
    const missing = [...usedKeys()].filter((key) => t(key) === key).sort();
    expect(missing, 'missing from the MESSAGES table in lib/i18n.ts').toEqual([]);
  });

  test('locales agree on which keys exist', () => {
    const [first, ...rest] = LOCALES.map((locale) => [locale, localeKeys(locale)] as const);
    for (const [locale, keys] of rest) {
      const onlyInFirst = [...first[1]].filter((key) => !keys.has(key)).sort();
      const onlyInOther = [...keys].filter((key) => !first[1].has(key)).sort();
      expect(onlyInFirst, `in ${first[0]} but not ${locale}`).toEqual([]);
      expect(onlyInOther, `in ${locale} but not ${first[0]}`).toEqual([]);
    }
  });
});
