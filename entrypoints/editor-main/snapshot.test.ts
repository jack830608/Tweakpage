import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { captureBeforeAfter } from './snapshot';
import { EditsController } from './controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1><div id="host"></div>';
  history.replaceState({}, '', '/page');
});

test('captures edited then original with the tool ui hidden, and restores state', async () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  controller.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  const host = document.getElementById('host') as HTMLElement;

  const captures: Array<{ filename: string; hostHidden: boolean; title: string }> = [];
  fakeBrowser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as { type?: string; filename?: string };
    if (m.type === 'pg:capture') {
      captures.push({
        filename: m.filename!,
        hostHidden: host.style.display === 'none',
        title: el.textContent ?? '',
      });
    }
  });

  await captureBeforeAfter(controller, host, document, { gapMs: 0 });

  expect(captures).toHaveLength(2);
  expect(captures[0].filename).toMatch(/^tweakpage-localhost-edited-\d{8}\.png$/);
  expect(captures[0].title).toBe('Changed');
  expect(captures[0].hostHidden).toBe(true);
  expect(captures[1].filename).toMatch(/^tweakpage-localhost-original-\d{8}\.png$/);
  expect(captures[1].title).toBe('Original');
  expect(captures[1].hostHidden).toBe(true);

  expect(host.style.display).toBe('');
  expect(controller.isPreviewingOriginal()).toBe(false);
  expect(el.textContent).toBe('Changed');
});
