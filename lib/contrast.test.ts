import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * The pairings a person actually reads, checked as numbers rather than by eye.
 *
 * A review found white text on the dark theme's accent at 1.92:1 — the "Keep", "Got it"
 * and "Agree" buttons, the popup's own Edit this page, and the settings Save. Every one
 * of them is a primary action, and every one had been looked at many times. Contrast is
 * not a thing eyes are good at, so it is arithmetic from here.
 */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads a token's value out of the stylesheet, so the test cannot drift from the CSS. */
function token(css: string, name: string, occurrence: number): string {
  const found = [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'gi'))];
  expect(found.length, `--${name} should be defined at least ${occurrence + 1} times`)
    .toBeGreaterThan(occurrence);
  return found[occurrence][1].toLowerCase();
}

const AA = 4.5;

describe.each([
  ['editor', 'entrypoints/editor-main/editor.css'],
  ['popup', 'entrypoints/popup/popup.css'],
  ['options', 'entrypoints/options/options.css'],
])('%s', (_name, path) => {
  const css = readFileSync(path, 'utf8');
  // Occurrence 0 is the light theme; 1 is the first dark override.
  const cases = [
    ['light: text on a filled button', () => ratio(token(css, 'on-accent', 0), token(css, 'accent', 0))],
    ['dark: text on a filled button', () => ratio(token(css, 'on-accent', 1), token(css, 'accent', 1))],
    ['light: the accent as text', () => ratio(token(css, 'accent', 0), token(css, 'surface', 0))],
    ['light: tertiary text', () => ratio(token(css, 'ink-3', 0), token(css, 'surface', 0))],
    ['dark: tertiary text', () => ratio(token(css, 'ink-3', 1), token(css, 'surface', 1))],
  ] as const;

  test.each(cases)('%s clears AA', (_label, measure) => {
    expect(Number(measure().toFixed(2))).toBeGreaterThanOrEqual(AA);
  });
});

/**
 * The reset button lives in the property name's gutter. When the gutter was narrower
 * than the button, an edited field put the button on top of its own label — arithmetic
 * that no screenshot of an unedited panel could show.
 */
test('the reset gutter is at least as wide as the reset button', () => {
  const css = readFileSync('entrypoints/editor-main/editor.css', 'utf8');
  const steps = Object.fromEntries(
    [...css.matchAll(/--(h-\w+):\s*(\d+)px/g)].map((m) => [m[1], Number(m[2])]),
  );
  const gutter = /\.twk-field-name \{[^}]*grid-template-columns:\s*([^\s]+)/.exec(css)?.[1] ?? '';
  const button = /\.twk-section button\.twk-reset \{[^}]*width:\s*(\d+)px/.exec(css)?.[1];
  const gutterPx = gutter.startsWith('var(')
    ? steps[gutter.slice(6, -1)]
    : Number.parseInt(gutter, 10);
  expect(gutterPx, `gutter ${gutter}`).toBeGreaterThanOrEqual(Number(button));
});
