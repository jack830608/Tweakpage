import { beforeEach, describe, expect, test } from 'vitest';
import { eventTargetElement } from './useElementPicker';

describe('what the picker refuses to pick', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML =
      '<h1>Page</h1><div id="tweakpage-marker"><button>Tweakpage · 3 changes</button></div><div id="host"></div>';
    host = document.getElementById('host')!;
  });

  const clickOn = (el: Element) => {
    let captured: Event | null = null;
    document.addEventListener('click', (e) => (captured = e), { once: true, capture: true });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    return captured!;
  };

  test('the page itself is pickable', () => {
    const h1 = document.querySelector('h1')!;
    expect(eventTargetElement(clickOn(h1), host)).toBe(h1);
  });

  test("tweakpage's own marker is not part of the page", () => {
    // The bottom-left "x changes" pill is ours; selecting it offers to edit UI that
    // does not exist in the page and will not survive a reload.
    const button = document.querySelector('#tweakpage-marker button')!;
    expect(eventTargetElement(clickOn(button), host)).toBeNull();
  });

  test('the editor host is not part of the page either', () => {
    expect(eventTargetElement(clickOn(host), host)).toBeNull();
  });
});
