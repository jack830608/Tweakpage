import { expect, test } from 'vitest';
import { revealElement } from './reveal';

interface Probe {
  el: Element;
  calls: ScrollIntoViewOptions[];
}

function elementAt(top: number, bottom: number): Probe {
  const calls: ScrollIntoViewOptions[] = [];
  const el = {
    getBoundingClientRect: () => ({ top, bottom }) as DOMRect,
    scrollIntoView: (options: ScrollIntoViewOptions) => calls.push(options),
  } as unknown as Element;
  return { el, calls };
}

function viewport(reducedMotion = false): Window {
  return {
    innerHeight: 800,
    matchMedia: () => ({ matches: reducedMotion }),
    // Run the deferred scroll straight away so the tests stay synchronous.
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      fn(0);
      return 0;
    },
  } as unknown as Window;
}

test('scrolls to an element below the fold', () => {
  const { el, calls } = elementAt(1600, 1700);
  revealElement(el, viewport());
  expect(calls).toHaveLength(1);
  expect(calls[0].block).toBe('center');
  expect(calls[0].behavior).toBe('smooth');
});

test('scrolls to an element above the viewport', () => {
  const { el, calls } = elementAt(-400, -320);
  revealElement(el, viewport());
  expect(calls).toHaveLength(1);
});

test('leaves an element that is already on screen alone', () => {
  const { el, calls } = elementAt(120, 300);
  revealElement(el, viewport());
  expect(calls, 'clicking a change for what you can already see should not move the page').toHaveLength(0);
});

test('an element hugging the top edge still gets centred', () => {
  const { el, calls } = elementAt(4, 60);
  revealElement(el, viewport());
  expect(calls).toHaveLength(1);
});

test('an element taller than the viewport is centred rather than skipped', () => {
  const { el, calls } = elementAt(-200, 1400);
  revealElement(el, viewport());
  expect(calls).toHaveLength(1);
});

test('reduced motion jumps instead of animating', () => {
  const { el, calls } = elementAt(1600, 1700);
  revealElement(el, viewport(true));
  expect(calls[0].behavior).toBe('auto');
});

test('does nothing when the host has no scrollIntoView', () => {
  const el = { getBoundingClientRect: () => ({ top: 900, bottom: 950 }) as DOMRect } as Element;
  expect(() => revealElement(el, viewport())).not.toThrow();
});
