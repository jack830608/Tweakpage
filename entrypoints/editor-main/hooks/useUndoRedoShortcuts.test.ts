import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useUndoRedoShortcuts } from './useUndoRedoShortcuts';

afterEach(cleanup);

beforeEach(() => {
  document.body.innerHTML = '<p id="p">x</p><div id="host"><input id="field"></div>';
});

function key(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

test('cmd+z outside the panel undoes; inside the panel the browser keeps it', () => {
  const host = document.getElementById('host') as HTMLElement;
  const undo = vi.fn();
  const redo = vi.fn();
  renderHook(() => useUndoRedoShortcuts(host, { undo, redo }));

  const outside = key(document.getElementById('p')!, { key: 'z', metaKey: true });
  expect(undo).toHaveBeenCalledTimes(1);
  expect(outside.defaultPrevented).toBe(true);

  const inside = key(document.getElementById('field')!, { key: 'z', metaKey: true });
  expect(undo).toHaveBeenCalledTimes(1);
  expect(inside.defaultPrevented).toBe(false);

  key(document.getElementById('p')!, { key: 'z', metaKey: true, shiftKey: true });
  expect(redo).toHaveBeenCalledTimes(1);
  expect(undo).toHaveBeenCalledTimes(1);

  key(document.getElementById('p')!, { key: 'z', ctrlKey: true });
  expect(undo).toHaveBeenCalledTimes(2);
});
