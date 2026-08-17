import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShareRow } from './ShareRow';
import { EditsController } from '../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});




test('export json sends the exported page as a data-url download message', async () => {
  const received: Array<{ type?: string; filename?: string; url?: string }> = [];
  fakeBrowser.runtime.onMessage.addListener((message: unknown) => {
    received.push(message as { type?: string; filename?: string; url?: string });
  });
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ShareRow controller={controller} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Export JSON/ }));
  await Promise.resolve();
  expect(received).toHaveLength(1);
  expect(received[0].type).toBe('tweakpage:download');
  expect(received[0].filename).toMatch(/^tweakpage-localhost-\d{8}\.json$/);
  const base64 = received[0].url!.split(',')[1]!;
  const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  expect(decoded.records).toHaveLength(1);
});

test('copy summary writes the change list to the clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ShareRow controller={controller} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Copy summary/ }));
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0][0]).toContain('# Page edits —');
  expect(writeText.mock.calls[0][0]).toContain('"Original" → "Changed"');
});


test('copy summary reports success via toast', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const controller = new EditsController(null, document, NOW);
  const onToast = vi.fn();
  render(<ShareRow controller={controller} onToast={onToast} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Copy summary/ }));
  await Promise.resolve();
  await Promise.resolve();
  expect(onToast).toHaveBeenCalledWith({ message: 'Summary copied to clipboard' });
});

test('snap button triggers the snapshot flow', () => {
  const controller = new EditsController(null, document, NOW);
  const onSnapshot = vi.fn();
  render(<ShareRow controller={controller} onToast={vi.fn()} onSnapshot={onSnapshot} />);
  fireEvent.click(screen.getByRole('button', { name: 'Snapshot before and after' }));
  expect(onSnapshot).toHaveBeenCalled();
});
