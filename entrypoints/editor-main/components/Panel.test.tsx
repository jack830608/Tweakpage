import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Panel } from './Panel';
import { getBreadcrumb } from './Breadcrumb';
import { EditsController } from '../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML =
    '<h1 id="title" style="font-size: 32px; font-weight: 700; line-height: 40px; color: rgb(51, 51, 51)">Original</h1>';
});

function setup(selected: Element | null = document.getElementById('title')) {
  const controller = new EditsController(null, document, NOW);
  const onSelect = vi.fn();
  const onDeselect = vi.fn();
  render(
    <Panel
      controller={controller}
      selected={selected}
      onSelect={onSelect}
      onDeselect={onDeselect}
      onClose={vi.fn()}
    />,
  );
  return { controller, onSelect, onDeselect };
}

test('shows the empty state without a selection', () => {
  setup(null);
  expect(screen.getByText('Select an element on the page to edit it.')).toBeTruthy();
});

test('text edits live-sync through the controller', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Changed' } });
  expect(document.getElementById('title')!.textContent).toBe('Changed');
  const record = controller.getPage().records.find((r) => r.property === 'textContent')!;
  expect(record.oldValue).toBe('Original');
  expect(record.newValue).toBe('Changed');
});

test('font size records a style edit in px', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '40' } });
  const record = controller.getPage().records.find((r) => r.property === 'fontSize')!;
  expect(record.oldValue).toBe('32px');
  expect(record.newValue).toBe('40px');
});

test('color hex input records a color edit', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Color hex'), { target: { value: '#ff0000' } });
  const record = controller.getPage().records.find((r) => r.property === 'color')!;
  expect(record.newValue).toBe('#ff0000');
});

test('iframes show the unsupported notice', () => {
  document.body.innerHTML = '<iframe id="frame"></iframe>';
  setup(document.getElementById('frame'));
  expect(screen.getByText("Editing inside iframes isn't supported.")).toBeTruthy();
});

test('getBreadcrumb walks ancestors and first child', () => {
  document.body.innerHTML = '<section><div><h2>Hi <span>there</span></h2></div></section>';
  const h2 = document.querySelector('h2')!;
  const crumb = getBreadcrumb(h2);
  expect(crumb).toContain(document.querySelector('section'));
  expect(crumb).toContain(document.querySelector('div'));
  expect(crumb).toContain(h2);
  expect(crumb[crumb.length - 1]).toBe(document.querySelector('span'));
});

test('breadcrumb buttons change the selection', () => {
  document.body.innerHTML = '<div><h1 id="title">Original</h1></div>';
  const { onSelect } = setup(document.getElementById('title'));
  fireEvent.click(screen.getByRole('button', { name: 'div' }));
  expect(onSelect).toHaveBeenCalledWith(document.querySelector('div'));
});

test('an edited property shows a reset control that reverts it', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '40' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset fontSize' }));
  expect(controller.getPage().records).toHaveLength(0);
});

test('warns when text editing would flatten nested markup', () => {
  document.body.innerHTML =
    '<h1 id="title" style="font-size: 32px; color: rgb(51, 51, 51)">Save <strong>20%</strong> today</h1>';
  setup(document.getElementById('title'));
  expect(screen.getByText(/replaces them with\s+plain text/)).toBeTruthy();
});

test('no flattening warning for plain text elements', () => {
  setup();
  expect(screen.queryByText(/replaces them with\s+plain text/)).toBeNull();
});

test('hide element records a display none edit and deselects', () => {
  const { controller, onDeselect } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Hide element' }));
  const record = controller.getPage().records.find((r) => r.property === 'display')!;
  expect(record.type).toBe('style');
  expect(record.newValue).toBe('none');
  expect(onDeselect).toHaveBeenCalled();
});

test('show original toggle reverts and restores edits', () => {
  setup();
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Changed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
  expect(document.getElementById('title')!.textContent).toBe('Original');
  fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
  expect(document.getElementById('title')!.textContent).toBe('Changed');
});

test('line height input keeps the typed value instead of snapping to computed px', () => {
  setup();
  const input = screen.getByLabelText('Line height') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '1.5' } });
  expect(input.value).toBe('1.5');
});
