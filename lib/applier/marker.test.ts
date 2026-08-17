import { beforeEach, expect, test, vi } from 'vitest';
import { MARKER_HOST_ID, removeMarker, setMarkerHidden, showMarker } from './marker';

beforeEach(() => {
  document.body.innerHTML = '';
});

const marker = () => document.getElementById(MARKER_HOST_ID);
const text = () => marker()?.shadowRoot?.querySelector('button')?.textContent ?? '';

test('says how many changes the page is showing', () => {
  showMarker(document, 3, () => {});
  expect(text()).toContain('3');
  expect(marker()?.shadowRoot, 'its own shadow root, so page CSS cannot hide it').toBeTruthy();
});

test('explains what it means, for someone who did not make the edits', () => {
  showMarker(document, 1, () => {});
  const title = marker()!.shadowRoot!.querySelector('button')!.getAttribute('title') ?? '';
  expect(title).toMatch(/not what the site serves/i);
});

test('updates in place rather than stacking up', () => {
  showMarker(document, 1, () => {});
  showMarker(document, 5, () => {});
  expect(document.querySelectorAll(`#${MARKER_HOST_ID}`)).toHaveLength(1);
  expect(text()).toContain('5');
});

test('goes away when the page is back to normal', () => {
  showMarker(document, 2, () => {});
  showMarker(document, 0, () => {});
  expect(marker()).toBeNull();
});

test('clicking it opens the editor', () => {
  const onOpen = vi.fn();
  showMarker(document, 1, onOpen);
  marker()!.shadowRoot!.querySelector('button')!.click();
  expect(onOpen).toHaveBeenCalled();
});

test('hides for a screenshot without being torn down', () => {
  showMarker(document, 1, () => {});
  setMarkerHidden(document, true);
  expect((marker() as HTMLElement).style.display).toBe('none');
  setMarkerHidden(document, false);
  expect((marker() as HTMLElement).style.display).toBe('');
  removeMarker(document);
  expect(marker()).toBeNull();
});
