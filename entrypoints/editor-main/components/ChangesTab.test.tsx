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
  render(<ChangesTab controller={new EditsController(null, document, NOW)} />);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});

test('lists records with label and diff, delete removes them', () => {
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} />);
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
  render(<ChangesTab controller={new EditsController(initial, document, NOW)} />);
  expect(screen.getByText("Couldn't apply on this page")).toBeTruthy();
});

test('revert all clears records', () => {
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} />);
  fireEvent.click(screen.getByRole('button', { name: 'Revert all' }));
  expect(controller.getPage().records).toHaveLength(0);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});


