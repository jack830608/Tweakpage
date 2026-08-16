import { beforeEach, expect, test } from 'vitest';
import { similarSelector } from './similar';

beforeEach(() => {
  document.body.innerHTML = '';
});

test('finds the family a repeated element belongs to', () => {
  document.body.innerHTML =
    '<a class="btn primary" id="one">A</a><a class="btn primary">B</a><a class="btn primary">C</a>';
  const set = similarSelector(document.getElementById('one')!)!;
  expect(set.count).toBe(3);
  expect(document.querySelectorAll(set.selector)).toHaveLength(3);
});

test('offers nothing when the element is one of a kind', () => {
  document.body.innerHTML = '<h1 class="title">Only</h1><p>text</p>';
  expect(similarSelector(document.querySelector('h1')!)).toBeNull();
});

test('falls back to the tag when classes are unstable', () => {
  document.body.innerHTML = '<button id="a">A</button><button>B</button>';
  const set = similarSelector(document.getElementById('a')!)!;
  expect(set.selector).toBe('button');
  expect(set.count).toBe(2);
});

test('declines a family too large to be a deliberate choice', () => {
  document.body.innerHTML = Array.from({ length: 120 }, () => '<div class="row">x</div>').join('');
  expect(similarSelector(document.querySelector('.row')!)).toBeNull();
});
