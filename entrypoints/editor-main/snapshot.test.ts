import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { captureBeforeAfter } from './snapshot';
import { EditsController } from './controller';

const NOW = () => '2026-08-15T10:00:00.000Z';
const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1><div id="host"></div>';
  history.replaceState({}, '', '/page');
});

/** happy-dom has no raster pipeline, so stand in for the image and canvas work. */
function stubCanvas(): { composed: () => string | null } {
  let composed: string | null = null;
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') {
      return Object.getPrototypeOf(document).createElement.call(document, tag);
    }
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        font: '',
        textBaseline: '',
        fillRect: () => {},
        drawImage: () => {},
        fillText: () => {},
      }),
      toDataURL: () => {
        composed = 'data:image/png;base64,composite';
        return composed;
      },
    } as unknown as HTMLElement;
  }) as never);

  class FakeImage {
    width = 100;
    height = 50;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
  return { composed: () => composed };
}

test('captures both states with the tool hidden, then saves one side-by-side image', async () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  controller.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  const host = document.getElementById('host') as HTMLElement;
  const canvas = stubCanvas();

  const grabs: Array<{ hostHidden: boolean; title: string }> = [];
  let saved: { filename?: string; url?: string } | null = null;
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation((async (message: unknown) => {
    const m = message as { type?: string; filename?: string; url?: string };
    if (m.type === 'tweakpage:grab') {
      grabs.push({ hostHidden: host.style.display === 'none', title: el.textContent ?? '' });
      return PIXEL;
    }
    if (m.type === 'tweakpage:save-png') saved = { filename: m.filename, url: m.url };
    return undefined;
  }) as never);

  await captureBeforeAfter(controller, host, document, { gapMs: 0 });

  expect(grabs).toHaveLength(2);
  expect(grabs[0], 'the edited page is captured first').toEqual({ hostHidden: true, title: 'Changed' });
  expect(grabs[1]).toEqual({ hostHidden: true, title: 'Original' });

  expect(saved!.filename).toMatch(/^tweakpage-localhost-before-after-\d{8}\.png$/);
  expect(saved!.url).toBe(canvas.composed());

  expect(host.style.display).toBe('');
  expect(controller.isPreviewingOriginal()).toBe(false);
  expect(el.textContent).toBe('Changed');
});

test('a failed capture restores the page instead of saving half a comparison', async () => {
  const controller = new EditsController(null, document, NOW);
  const host = document.getElementById('host') as HTMLElement;
  stubCanvas();
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined as never);

  await expect(captureBeforeAfter(controller, host, document, { gapMs: 0 })).rejects.toThrow();
  expect(host.style.display).toBe('');
  expect(controller.isPreviewingOriginal()).toBe(false);
});
