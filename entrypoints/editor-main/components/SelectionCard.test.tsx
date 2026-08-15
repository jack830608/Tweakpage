import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SelectionCard } from './SelectionCard';
import { EditsController } from '../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});

test('hide toggles to unhide and back, keeping the selection context', () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  render(<SelectionCard element={el} controller={controller} onSelect={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Hide element' }));
  const record = controller.getPage().records.find((r) => r.property === 'display')!;
  expect(record.newValue).toBe('none');

  const unhide = screen.getByRole('button', { name: 'Unhide element' });
  fireEvent.click(unhide);
  expect(controller.getPage().records).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Hide element' })).toBeTruthy();
});
