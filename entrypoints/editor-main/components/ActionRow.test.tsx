import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionRow } from './ActionRow';
import { EditsController } from '../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});

function hideButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Hide element/ }) as HTMLButtonElement;
}

test('hide is disabled without a selection and while previewing', () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  const { rerender } = render(<ActionRow controller={controller} selected={null} onDeselect={vi.fn()} onSelect={vi.fn()} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  expect(hideButton().disabled).toBe(true);
  rerender(<ActionRow controller={controller} selected={el} onDeselect={vi.fn()} onSelect={vi.fn()} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  expect(hideButton().disabled).toBe(false);
  controller.setPreviewOriginal(true);
  rerender(<ActionRow controller={controller} selected={el} onDeselect={vi.fn()} onSelect={vi.fn()} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  expect(hideButton().disabled).toBe(true);
});

test('hide records a display none edit and deselects', () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  const onDeselect = vi.fn();
  render(<ActionRow controller={controller} selected={el} onDeselect={onDeselect} />);
  fireEvent.click(hideButton());
  const record = controller.getPage().records.find((r) => r.property === 'display')!;
  expect(record.type).toBe('style');
  expect(record.newValue).toBe('none');
  expect(onDeselect).toHaveBeenCalled();
});

test('export json sends the exported page as a data-url download message', async () => {
  const received: Array<{ type?: string; filename?: string; url?: string }> = [];
  fakeBrowser.runtime.onMessage.addListener((message: unknown) => {
    received.push(message as { type?: string; filename?: string; url?: string });
  });
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ActionRow controller={controller} selected={null} onDeselect={vi.fn()} onSelect={vi.fn()} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Export JSON/ }));
  await Promise.resolve();
  expect(received).toHaveLength(1);
  expect(received[0].type).toBe('pg:download');
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
  render(<ActionRow controller={controller} selected={null} onDeselect={vi.fn()} onSelect={vi.fn()} onToast={vi.fn()} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Copy summary/ }));
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0][0]).toContain('# Page edits —');
  expect(writeText.mock.calls[0][0]).toContain('"Original" → "Changed"');
});

test('hide shows an undo toast that restores and reselects the element', () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  const onToast = vi.fn();
  const onSelect = vi.fn();
  render(
    <ActionRow controller={controller} selected={el} onDeselect={vi.fn()} onSelect={onSelect} onToast={onToast} onSnapshot={vi.fn()} />,
  );
  fireEvent.click(hideButton());
  expect(onToast).toHaveBeenCalledTimes(1);
  const toast = onToast.mock.calls[0][0];
  expect(toast.message).toBe('Element hidden');
  expect(toast.actionLabel).toBe('Undo');
  toast.onAction();
  expect(controller.getPage().records).toHaveLength(0);
  expect(onSelect).toHaveBeenCalledWith(el);
});

test('copy summary reports success via toast', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const controller = new EditsController(null, document, NOW);
  const onToast = vi.fn();
  render(<ActionRow controller={controller} selected={null} onDeselect={vi.fn()} onSelect={vi.fn()} onToast={onToast} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Copy summary/ }));
  await Promise.resolve();
  await Promise.resolve();
  expect(onToast).toHaveBeenCalledWith({ message: 'Summary copied to clipboard' });
});

test('snap button triggers the snapshot flow', () => {
  const controller = new EditsController(null, document, NOW);
  const onSnapshot = vi.fn();
  render(
    <ActionRow
      controller={controller}
      selected={null}
      onDeselect={vi.fn()}
      onSelect={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={onSnapshot}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Snapshot before and after' }));
  expect(onSnapshot).toHaveBeenCalled();
});
