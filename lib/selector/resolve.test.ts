import { beforeEach, expect, test } from 'vitest';
import { resolveRecord } from './resolve';

beforeEach(() => {
  document.body.innerHTML = '';
});

const rec = (selector: string, fallbackSelectors: string[] = [], textFingerprint?: string) => ({
  selector,
  fallbackSelectors,
  textFingerprint,
});

test('resolves a unique primary selector', () => {
  document.body.innerHTML = '<h1 class="title">Hi</h1>';
  expect(resolveRecord(rec('.title'), document)).toBe(document.querySelector('.title'));
});

test('rejects a primary selector matching multiple elements', () => {
  document.body.innerHTML = '<p class="x">a</p><p class="x">b</p>';
  expect(resolveRecord(rec('.x'), document)).toBeNull();
});

test('falls back when the primary matches nothing', () => {
  document.body.innerHTML = '<div><span class="new-name">Hello</span></div>';
  const el = document.querySelector('span')!;
  expect(resolveRecord(rec('.old-name', ['html > body > div:nth-child(1) > span:nth-child(1)']), document)).toBe(el);
});

test('survives an invalid stored selector', () => {
  document.body.innerHTML = '<em>x</em>';
  expect(resolveRecord(rec('div[[', ['html > body > em:nth-child(1)']), document)).toBe(
    document.querySelector('em'),
  );
});

test('uses the text fingerprint as last resort when unique', () => {
  document.body.innerHTML = '<h2>Alpha</h2><h2>Beta</h2>';
  const el = document.querySelectorAll('h2')[1];
  expect(resolveRecord(rec('h2.gone', [], 'Beta'), document)).toBe(el);
});

test('rejects an ambiguous fingerprint', () => {
  document.body.innerHTML = '<h2>Same</h2><h2>Same</h2>';
  expect(resolveRecord(rec('h2.gone', [], 'Same'), document)).toBeNull();
});

test('returns null when everything misses', () => {
  document.body.innerHTML = '<p>text</p>';
  expect(resolveRecord(rec('.nope', ['.also-nope'], 'missing'), document)).toBeNull();
});
