import { beforeEach, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardPicker } from './useKeyboardPicker';

function press(key: string, altKey = true) {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, bubbles: true, composed: true }));
}

beforeEach(() => {
  document.body.innerHTML =
    '<div id="host"></div><section id="wrap"><h1 id="one">One</h1><p id="two">Two</p></section>';
  // happy-dom reports zero-size boxes; give the pickable elements a size.
  for (const el of Array.from(document.querySelectorAll('#wrap, #one, #two'))) {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 20 } as DOMRect);
  }
});

function setup(selected: Element | null) {
  const host = document.getElementById('host') as HTMLElement;
  const onSelect = vi.fn();
  renderHook(() => useKeyboardPicker(host, { enabled: true, selected, onSelect }));
  return onSelect;
}

test('alt+down moves into the first child', () => {
  const onSelect = setup(document.getElementById('wrap'));
  press('ArrowDown');
  expect(onSelect).toHaveBeenCalledWith(document.getElementById('one'));
});

test('alt+up moves to the parent', () => {
  const onSelect = setup(document.getElementById('one'));
  press('ArrowUp');
  expect(onSelect).toHaveBeenCalledWith(document.getElementById('wrap'));
});

test('alt+right and alt+left move between siblings', () => {
  const onSelect = setup(document.getElementById('one'));
  press('ArrowRight');
  expect(onSelect).toHaveBeenCalledWith(document.getElementById('two'));
});

test('with nothing selected, alt+down starts at the top of the page', () => {
  const onSelect = setup(null);
  press('ArrowDown');
  expect(onSelect).toHaveBeenCalledWith(document.getElementById('wrap'));
});

test('plain arrows are left to the page', () => {
  const onSelect = setup(document.getElementById('wrap'));
  press('ArrowDown', false);
  expect(onSelect).not.toHaveBeenCalled();
});

test('the editor never selects its own UI', () => {
  const onSelect = setup(document.getElementById('host'));
  press('ArrowDown');
  expect(onSelect).not.toHaveBeenCalled();
});
