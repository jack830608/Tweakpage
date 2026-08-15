import { beforeEach, expect, test } from 'vitest';
import { eventTargetElement } from './useElementPicker';

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
