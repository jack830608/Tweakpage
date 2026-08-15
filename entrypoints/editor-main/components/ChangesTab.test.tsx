import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChangesTab } from './ChangesTab';
import { EditsController } from '../controller';
import { emptyPageEdits, type PageEdits } from '../../../lib/edits/types';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});

test('shows the empty state with no records', () => {
  render(<ChangesTab controller={new EditsController(null, document, NOW)} onToast={vi.fn()} onHighlight={vi.fn()} onSelectRecord={vi.fn()} />);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});

test('lists records with label and diff, delete removes them', () => {
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} onToast={vi.fn()} onHighlight={vi.fn()} onSelectRecord={vi.fn()} />);
  expect(screen.getByText(/h1#title/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
  expect(controller.getPage().records).toHaveLength(0);
  expect(document.getElementById('title')!.textContent).toBe('Original');
});

test('flags records that could not be applied', () => {
  const initial: PageEdits = {
    ...emptyPageEdits('http://localhost/page', 'T', NOW()),
    records: [
      {
        id: 'r1', selector: '.does-not-exist', fallbackSelectors: [], elementLabel: 'p.gone',
        type: 'style', property: 'color', oldValue: '#000000', newValue: '#ff0000',
        enabled: true, createdAt: NOW(), updatedAt: NOW(),
      },
    ],
  };
  render(<ChangesTab controller={new EditsController(initial, document, NOW)} onToast={vi.fn()} onHighlight={vi.fn()} onSelectRecord={vi.fn()} />);
  expect(screen.getByText("Couldn't apply on this page")).toBeTruthy();
});

test('revert all clears records', () => {
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} onToast={vi.fn()} onHighlight={vi.fn()} onSelectRecord={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Revert all' }));
  expect(controller.getPage().records).toHaveLength(0);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});



async function importFile(json: string): Promise<void> {
  const input = screen.getByLabelText('Import JSON file') as HTMLInputElement;
  const file = new File([json], 'edits.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(json) });
  fireEvent.change(input, { target: { files: [file] } });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test('importing a matching export applies edits to the current page', async () => {
  const controller = new EditsController(null, document, NOW);
  const onToast = vi.fn();
  render(<ChangesTab controller={controller} onToast={onToast} onHighlight={vi.fn()} onSelectRecord={vi.fn()} />);
  const json = JSON.stringify({
    version: 1,
    url: `${location.origin}/page`,
    title: 'T',
    updatedAt: NOW(),
    records: [{
      id: 'r1', selector: '#title', fallbackSelectors: [], elementLabel: 'h1#title',
      type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Imported',
      enabled: true, createdAt: NOW(), updatedAt: NOW(),
    }],
  });
  await importFile(json);
  expect(controller.getPage().records).toHaveLength(1);
  expect(document.getElementById('title')!.textContent).toBe('Imported');
  expect(onToast).toHaveBeenCalledWith({ message: 'Imported 1 edits' });
});

test('importing invalid json reports an error toast', async () => {
  const controller = new EditsController(null, document, NOW);
  const onToast = vi.fn();
  render(<ChangesTab controller={controller} onToast={onToast} onHighlight={vi.fn()} onSelectRecord={vi.fn()} />);
  await importFile('nope');
  expect(onToast).toHaveBeenCalledWith({ message: 'Import failed: not valid JSON' });
  expect(controller.getPage().records).toHaveLength(0);
});

test('hovering a change highlights its element; clicking selects it; the switch toggles', () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  controller.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  const onHighlight = vi.fn();
  const onSelectRecord = vi.fn();
  render(
    <ChangesTab controller={controller} onToast={vi.fn()} onHighlight={onHighlight} onSelectRecord={onSelectRecord} />,
  );
  const item = screen.getByText(/h1#title/).closest('li')!;
  fireEvent.mouseEnter(item);
  expect(onHighlight).toHaveBeenCalledWith(el);
  fireEvent.mouseLeave(item);
  expect(onHighlight).toHaveBeenLastCalledWith(null);
  fireEvent.click(item);
  expect(onSelectRecord).toHaveBeenCalledWith(el);
  fireEvent.click(screen.getByRole('checkbox', { name: /Toggle text change/ }));
  expect(controller.getPage().records[0].enabled).toBe(false);
  expect(el.textContent).toBe('Original');
});
