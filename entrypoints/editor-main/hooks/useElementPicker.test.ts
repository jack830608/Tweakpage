import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { eventTargetElement, useElementPicker } from './useElementPicker';

afterEach(cleanup);

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

test('Escape works from inside the panel as well as from the page', () => {
  const host = document.getElementById('host')!;
  const onEscape = vi.fn();
  renderHook(() =>
    useElementPicker(host, true, { onHover: () => {}, onSelect: () => {}, onEscape }),
  );

  // Ignoring keys from inside the panel left Escape dead whenever focus sat on a control.
  document.getElementById('inside')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  expect(onEscape).toHaveBeenCalledTimes(1);

  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  expect(onEscape).toHaveBeenCalledTimes(2);
});

test('Escape in a text field leaves the field instead of the selection', () => {
  const host = document.getElementById('host')!;
  const onEscape = vi.fn();
  renderHook(() =>
    useElementPicker(host, true, { onHover: () => {}, onSelect: () => {}, onEscape }),
  );
  const input = document.createElement('input');
  document.getElementById('inside')!.append(input);
  input.focus();

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  expect(onEscape).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(input);
});

test('Alt-held clicks and hovers pass through to the page', () => {
  const host = document.getElementById('host')!;
  const onSelect = vi.fn();
  const onHover = vi.fn();
  renderHook(() => useElementPicker(host, true, { onHover, onSelect, onEscape: () => {} }));

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

test('disabled picker passes clicks and hovers through but still handles Escape', () => {
  const host = document.getElementById('host')!;
  const onSelect = vi.fn();
  const onHover = vi.fn();
  const onEscape = vi.fn();
  renderHook(() => useElementPicker(host, false, { onHover, onSelect, onEscape }));

  const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
  document.getElementById('p')!.dispatchEvent(click);
  expect(onSelect).not.toHaveBeenCalled();
  expect(click.defaultPrevented).toBe(false);

  document.getElementById('p')!.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, composed: true }),
  );
  expect(onHover).not.toHaveBeenCalled();

  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  );
  expect(onEscape).toHaveBeenCalledTimes(1);
});
