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

test('hide records a display none edit, deselects, and the undo toast reselects', () => {
  const controller = new EditsController(null, document, NOW);
  const el = document.getElementById('title')!;
  const onDeselect = vi.fn();
  const onSelect = vi.fn();
  const onToast = vi.fn();
  render(
    <SelectionCard
      element={el}
      controller={controller}
      onSelect={onSelect}
      onDeselect={onDeselect}
      onToast={onToast}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hide element' }));
  const record = controller.getPage().records.find((r) => r.property === 'display')!;
  expect(record.newValue).toBe('none');
  expect(onDeselect).toHaveBeenCalled();
  const toast = onToast.mock.calls[0][0];
  expect(toast.actionLabel).toBe('Undo');
  toast.onAction();
  expect(controller.getPage().records).toHaveLength(0);
  expect(onSelect).toHaveBeenCalledWith(el);
});
