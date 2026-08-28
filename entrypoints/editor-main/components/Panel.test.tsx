import { fakeBrowser } from 'wxt/testing';
import { t } from '../../../lib/i18n';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Panel } from './Panel';
import { getBreadcrumb } from './Breadcrumb';
import { EditsController } from '../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML =
    '<h1 id="title" style="font-size: 32px; font-weight: 700; line-height: 40px; color: rgb(51, 51, 51)">Original</h1>';
  history.replaceState({}, '', '/page');
});

function setup(selected: Element | null = document.getElementById('title')) {
  const controller = new EditsController(null, document, NOW);
  const onSelect = vi.fn();
  const onModeChange = vi.fn();
  const onDismissOnboarding = vi.fn();
  render(
    <Panel
      controller={controller}
      selected={selected}
      mode="edit"
      onModeChange={onModeChange}
      showOnboarding={false}
      onDismissOnboarding={onDismissOnboarding}
      onSelect={onSelect}
      onHighlight={vi.fn()}
      onPreviewSet={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  // Sections nest, so one pass opens the groups and leaves their children closed. Round
  // and round until nothing is closed reaches every depth.
  for (let round = 0; round < 4; round++) {
    const closed = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-section][aria-expanded="false"]'),
    );
    if (closed.length === 0) break;
    closed.forEach((header) => fireEvent.click(header));
  }
  return { controller, onSelect, onModeChange, onDismissOnboarding };
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
  fireEvent.change(screen.getByLabelText(t('aria_hex', ['Color'])), { target: { value: '#ff0000' } });
  const record = controller.getPage().records.find((r) => r.property === 'color')!;
  expect(record.newValue).toBe('#ff0000');
});

test('a section can be collapsed and reopened', () => {
  const { controller } = setup();
  // setup() opens everything; collapsing and reopening is the behaviour under test.
  fireEvent.click(screen.getByRole('button', { name: /^Spacing/ }));
  expect(screen.queryByLabelText('padding top')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^Spacing/ }));
  fireEvent.change(screen.getByLabelText('padding top'), { target: { value: '24' } });
  expect(controller.getPage().records.find((r) => r.property === 'paddingTop')!.newValue).toBe(
    '24px',
  );
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

test('an element with inline markup gets one box per run of text', () => {
  document.body.innerHTML =
    '<h1 id="title" style="font-size: 32px; color: rgb(51, 51, 51)">Save <strong>20%</strong> today</h1>';
  const { controller } = setup(document.getElementById('title'));

  const first = screen.getByTestId('text-run-0') as HTMLTextAreaElement;
  expect(first.value).toBe('Save ');
  fireEvent.change(first, { target: { value: 'Take ' } });

  // Editing used to write textContent, which replaced <strong> with a flat string.
  expect(document.querySelector('#title strong')?.textContent).toBe('20%');
  expect(document.getElementById('title')!.textContent).toBe('Take 20% today');
  expect(controller.getPage().records[0].property).toBe('textNode:0');
});

test('editing the emphasised run leaves the surrounding text alone', () => {
  document.body.innerHTML = '<h1 id="title">Save <strong>20%</strong> today</h1>';
  setup(document.getElementById('title'));
  fireEvent.change(screen.getByTestId('text-run-1'), { target: { value: '30%' } });
  expect(document.querySelector('#title strong')!.textContent).toBe('30%');
  expect(document.getElementById('title')!.textContent).toBe('Save 30% today');
});

test('a plain element still edits as one box', () => {
  setup();
  expect(screen.getByTestId('text')).toBeTruthy();
  expect(screen.queryByTestId('text-run-0')).toBeNull();
});

test('line height input keeps the typed value instead of snapping to computed px', () => {
  setup();
  const input = screen.getByLabelText('Line height') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '1.5' } });
  expect(input.value).toBe('1.5');
});

/**
 * A toggle in the footer, not a segmented control above the content. Turning it on
 * replaces the whole editing surface, so it is somewhere you go and come back from — and
 * it lives where its arrival cannot push anything down.
 */
test('compare peeks at the original and comes back', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Changed' } });
  const toggle = () => document.querySelector<HTMLButtonElement>('[data-testid="compare-original"]')!;
  expect(toggle().getAttribute('aria-pressed'), 'off until pressed').toBe('false');

  fireEvent.click(toggle());
  expect(controller.isPreviewingOriginal()).toBe(true);
  expect(document.getElementById('title')!.textContent).toBe('Original');
  expect(toggle().getAttribute('aria-pressed'), 'the toggle says so').toBe('true');
  // The instrument does not blank because the specimen changed. Replacing the body was
  // a 511px collapse that moved the toggle out from under the pointer that pressed it.
  expect(screen.getByLabelText('Text'), 'the fields stay put').toBeTruthy();
  expect(
    document.querySelector('.twk-panel')!.getAttribute('data-previewing'),
    'said with a ring, which is outside layout',
  ).toBe('true');

  fireEvent.click(toggle());
  expect(document.getElementById('title')!.textContent).toBe('Changed');
});

/**
 * The reported defect: the compare block was gated on the first edit and appeared above
 * the content, so making any change shifted the panel 88px under the cursor.
 */
test('making the first change adds nothing above the content', () => {
  setup();
  // Everything rendered before the card that is not an ancestor of it — chrome that
  // occupies space above the thing being edited, whatever part of the tree it comes from.
  const above = () => {
    const panel = document.querySelector('.twk-panel')!;
    const card = document.querySelector('.twk-selection-card')!;
    return Array.from(panel.querySelectorAll('*')).filter(
      (el) =>
        !el.contains(card) &&
        el.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).length;
  };
  const before = above();
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Changed' } });
  expect(above(), 'nothing new grew above the thing being edited').toBe(before);
});

test('footer navigates to the changes view and back', () => {
  setup();
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Changed' } });
  fireEvent.click(screen.getByRole('button', { name: /Review/ }));
  expect(screen.getByText(/h1#title/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Back to editing/ }));
  expect(screen.getByLabelText('Text')).toBeTruthy();
});

test('onboarding card renders when showOnboarding and dismisses', () => {
  const controller = new EditsController(null, document, NOW);
  const onDismissOnboarding = vi.fn();
  render(
    <Panel
      controller={controller}
      selected={null}
      mode="edit"
      onModeChange={vi.fn()}
      showOnboarding
      onDismissOnboarding={onDismissOnboarding}
      onSelect={vi.fn()}
      onHighlight={vi.fn()}
      onPreviewSet={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
  expect(onDismissOnboarding).toHaveBeenCalled();
});

test('stale context replaces the panel with a reload notice', () => {
  const controller = new EditsController(null, document, NOW);
  render(
    <Panel
      controller={controller}
      selected={document.getElementById('title')}
      stale
      mode="edit"
      onModeChange={vi.fn()}
      showOnboarding={false}
      onDismissOnboarding={vi.fn()}
      onSelect={vi.fn()}
      onHighlight={vi.fn()}
      onPreviewSet={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert').textContent).toContain('Tweakpage was updated');
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Export JSON' })).toBeNull();
});

test('interaction mode switch reports mode changes', () => {
  const { onModeChange } = setup();
  fireEvent.click(screen.getByRole('button', { name: /Browse/ }));
  expect(onModeChange).toHaveBeenCalledWith('browse');
});

/**
  * The content control is what the element *is* — its words, its picture, where it points
  * — and it is on screen without a disclosure. It used to be a drawer, which put the most
  * common edit in the product behind a click.
  */
test("an element's own content is on screen, and another element's is not", () => {
  setup();
  expect(
    document.querySelector('[data-testid="text"]'),
    'the words are editable straight away',
  ).toBeTruthy();
  expect(screen.queryByLabelText('Image URL'), 'a heading has no picture').toBeNull();
});

test('an image offers its picture, not a text box', () => {
  document.body.innerHTML = '<img id="pic" src="/a.png">';
  setup(document.getElementById('pic'));
  expect(screen.getByLabelText('Image URL')).toBeTruthy();
  expect(document.querySelector('[data-testid="text"]')).toBeNull();
});

test('invalid line height values are not recorded', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Line height'), { target: { value: '1.5; } body { display: none' } });
  expect(controller.getPage().records).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Line height'), { target: { value: '1.5' } });
  expect(controller.getPage().records.find((r) => r.property === 'lineHeight')!.newValue).toBe('1.5');
});

/**
 * Hiding used to replace everything below the card with a note, which collapsed the panel
 * by about five hundred pixels and took away the controls for an element whose properties
 * are all still real. The button that did it already reads Unhide — that was the whole
 * content of the note.
 */
test('hiding an element keeps its controls where they were', () => {
  const { controller } = setup();
  const groups = () => document.querySelectorAll('[data-section]').length;
  const before = groups();
  fireEvent.click(screen.getByRole('button', { name: 'Hide element' }));
  expect(controller.getPage().records.find((r) => r.property === 'display')!.newValue).toBe('none');
  expect(screen.getByLabelText('Text'), 'the fields stay').toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Unhide element' }),
    'and the button says what state it is in',
  ).toBeTruthy();
  expect(groups(), 'the groups are all still there — nothing collapsed').toBe(before);
});

/**
 * Only `text` opened by default and `text` only exists on an element with words of its
 * own, so a div — a wrapper, a section, most of any real page — opened to a selection
 * card above seven closed rows and no controls at all.
 */
test('an element with no text still opens to something', async () => {
  document.body.innerHTML = '<div id="wrap" style="padding:10px"><span>inner</span></div>';
  setup(document.getElementById('wrap')!);
  await waitFor(() =>
    expect(
      document.querySelectorAll('[data-section][aria-expanded="true"]').length,
      'at least one section is open',
    ).toBeGreaterThan(0),
  );
});

/**
 * The strip reads and never writes. That is the whole reason it is a summary rather than
 * the row of editors it started as: a second field binding on a property fights the first
 * over the draft, and no arrangement of two editors avoids it.
 */
test('the style summary states the element without recording anything', () => {
  const { controller } = setup();
  expect(document.querySelector('[data-testid="summary-fontSize"]')).toBeTruthy();
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="summary-color"]')!);
  expect(controller.getPage().records, 'pressing a chip is navigation, not an edit').toHaveLength(0);
});

test('a chip marks itself when its property has been changed', () => {
  const { controller } = setup();
  const chip = () => document.querySelector('[data-testid="summary-fontSize"]')!;
  expect(chip().className).not.toContain('modified');
  act(() => {
    controller.recordEdit(document.getElementById('title')!, 'style', 'fontSize', '16px', '40px');
  });
  expect(chip().className, 'the accent means changed here too').toContain('modified');
});

/** Font size says nothing about a picture. A summary is allowed to vary; a fixed bar is not. */
test('the summary describes the element it is looking at', () => {
  document.body.innerHTML = '<img id="pic" src="/a.png">';
  setup(document.getElementById('pic'));
  expect(document.querySelector('[data-testid="summary-width"]')).toBeTruthy();
  expect(document.querySelector('[data-testid="summary-fontSize"]')).toBeNull();
});
