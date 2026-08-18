import { expect, test } from 'vitest';
import { isOurs, sign } from './handshake';

test('what we signed is recognised', () => {
  expect(isOurs(sign({ updates: [] }))).toBe(true);
});

test('what the page made up is not', () => {
  // Exactly what a site's own script can put together.
  for (const forged of [
    { updates: [{ id: 'r1', oldValue: 'https://evil.example.com/x.png' }] },
    { updates: [], token: 'guessed' },
    { token: undefined },
    null,
    'token',
  ]) {
    expect(isOurs(forged), JSON.stringify(forged)).toBe(false);
  }
});

test('the token is not something the page could read off the DOM', () => {
  const signed = sign({ updates: [] }) as { token: string };
  expect(document.documentElement.outerHTML).not.toContain(signed.token);
});
