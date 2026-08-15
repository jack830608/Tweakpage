import { renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { eventTargetElement, useElementPicker } from './useElementPicker';

beforeEach(() => {
  document.body.innerHTML = '<p id="p">x</p><div id="host"><button id="inside">b</button></div>';
});

function capture(dispatchOn: Element): Event {
  let captured: Event | null = null;
  document.addEventListener('mousemove', (e) => { captured = e; }, { once: true, capture: true });
  dispatchOn.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));
  return captured!;
}

test('returns the element for events outside the host', () => {
  const host = document.getElementById('host')!;
  const e = capture(document.getElementById('p')!);
  expect(eventTargetElement(e, host)).toBe(document.getElementById('p'));
});

test('returns null for events inside the host', () => {
  const host = document.getElementById('host')!;
  const e = capture(document.getElementById('inside')!);
  expect(eventTargetElement(e, host)).toBeNull();
});

test('Escape inside the host does not fire onEscape; Escape outside does', () => {
  const host = document.getElementById('host')!;
  const onEscape = vi.fn();
  renderHook(() =>
    useElementPicker(host, { onHover: () => {}, onSelect: () => {}, onEscape }),
  );

  document.getElementById('inside')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  expect(onEscape).not.toHaveBeenCalled();

  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  expect(onEscape).toHaveBeenCalledTimes(1);
});

test('Alt-held clicks and hovers pass through to the page', () => {
  const host = document.getElementById('host')!;
  const onSelect = vi.fn();
  const onHover = vi.fn();
  renderHook(() => useElementPicker(host, { onHover, onSelect, onEscape: () => {} }));

  const altClick = new MouseEvent('click', { bubbles: true, composed: true, altKey: true, cancelable: true });
  document.getElementById('p')!.dispatchEvent(altClick);
  expect(onSelect).not.toHaveBeenCalled();
  expect(altClick.defaultPrevented).toBe(false);

  document.getElementById('p')!.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, composed: true, altKey: true }),
  );
  expect(onHover).toHaveBeenLastCalledWith(null);

  const plainClick = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
  document.getElementById('p')!.dispatchEvent(plainClick);
  expect(onSelect).toHaveBeenCalledWith(document.getElementById('p'));
});
