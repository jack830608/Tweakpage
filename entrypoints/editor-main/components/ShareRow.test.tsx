import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShareRow } from './ShareRow';
import { EditsController } from '../controller';
import { t } from '../../../lib/i18n';

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
  // Every hand-off asks the worker what to do about images first, so the download is
  // the message after that one.
  await waitFor(() => expect(received.some((m) => m.type === 'tweakpage:download')).toBe(true));
  const download = received.find((m) => m.type === 'tweakpage:download')!;
  expect(download.filename).toMatch(/^tweakpage-localhost-\d{8}\.json$/);
  const base64 = download.url!.split(',')[1]!;
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
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(writeText.mock.calls[0][0]).toContain('# Page edits —');
  expect(writeText.mock.calls[0][0]).toContain('`Original` → `Changed`');
});


test('copy summary reports success via toast', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const controller = new EditsController(null, document, NOW);
  const onToast = vi.fn();
  render(<ShareRow controller={controller} onToast={onToast} onSnapshot={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Copy summary/ }));
  await waitFor(() =>
    expect(onToast).toHaveBeenCalledWith({ message: 'Summary copied to clipboard', kind: 'success' }),
  );
});

test('snap button triggers the snapshot flow', () => {
  const controller = new EditsController(null, document, NOW);
  const onSnapshot = vi.fn();
  render(<ShareRow controller={controller} onToast={vi.fn()} onSnapshot={onSnapshot} />);
  fireEvent.click(screen.getByRole('button', { name: 'Snapshot before and after' }));
  expect(onSnapshot).toHaveBeenCalled();
});

test('the share button says it is uploading, refuses re-entry, then confirms', async () => {
  await fakeBrowser.storage.local.set({
    'tweakpage:share-settings': {
      bucket: 'demo-bucket', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's',
    },
  });
  let release!: (value: unknown) => void;
  const gate = new Promise((resolve) => (release = resolve));
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockReturnValue(
    gate.then(() => ({ ok: true, ref: { id: 'x'.repeat(22), bucket: 'b', region: 'r' } })) as never,
  );
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });

  const onToast = vi.fn();
  const controller = new EditsController(null, document, NOW);
  // A share needs something to share; the button is disabled without it.
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ShareRow controller={controller} onToast={onToast} onSnapshot={vi.fn().mockResolvedValue(true)} />);
  const button = await screen.findByTestId('share-link');
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));

  fireEvent.click(button);
  await waitFor(() => {
    // Seconds of S3 round-trips with a silent button reads as broken and gets re-clicked.
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  release(undefined);
  await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('false'));
  expect(onToast).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'success' }),
  );
});

test('a failed upload returns the button to idle with an error toast', async () => {
  await fakeBrowser.storage.local.set({
    'tweakpage:share-settings': {
      bucket: 'demo-bucket', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's',
    },
  });
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue({ ok: false, reason: 'network' } as never);

  const onToast = vi.fn();
  const controller = new EditsController(null, document, NOW);
  // A share needs something to share; the button is disabled without it.
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ShareRow controller={controller} onToast={onToast} onSnapshot={vi.fn().mockResolvedValue(true)} />);
  const button = await screen.findByTestId('share-link');
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));

  fireEvent.click(button);
  await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  expect(button.className, 'no success flash on failure').not.toContain('twk-done');
});

test('with nothing edited, the share button says so instead of making a dead link', async () => {
  // The recipient is written to reject a share with no records, so offering one is
  // offering a link that cannot work.
  await fakeBrowser.storage.local.set({
    'tweakpage:share-settings': {
      bucket: 'demo-bucket', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's',
      tinypngKey: '', compressImages: false,
      uploadImages: { summary: true, json: true, download: true, share: true },
    },
  });
  render(
    <ShareRow
      controller={new EditsController(null, document, NOW)}
      onToast={vi.fn()}
      onSnapshot={vi.fn().mockResolvedValue(true)}
    />,
  );
  const button = (await screen.findByTestId('share-link')) as HTMLButtonElement;
  // Configured, so the reason has to be the missing edits, not the missing bucket.
  await waitFor(() => expect(button.disabled).toBe(true));
  expect(button.title).toBe(t('tip_share_nothing'));
});
