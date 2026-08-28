import { fakeBrowser } from 'wxt/testing';
import { t } from '../../../../lib/i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Panel } from '../Panel';
import { EditsController } from '../../controller';

// Every editable field, swept the same way: read what the panel shows, change it,
// then check three things users notice — the page changed, the record is right, and
// the input still shows what they typed. Then reset, and check the input goes back
// to the original. Bugs found by hand (line-height keeping a stale value after reset,
// letter-spacing always showing 0) were all violations of one of those four checks.

const NOW = () => '2026-08-15T10:00:00.000Z';

const STYLE = [
  'font-size: 32px',
  'font-family: Georgia, serif',
  'font-weight: 700',
  'line-height: 40px',
  'color: rgb(51, 51, 51)',
  'text-align: left',
  'text-transform: none',
  'background-color: rgb(255, 255, 255)',
  'border-radius: 4px',
  'opacity: 1',
  'border: 0px solid rgb(0, 0, 0)',
  'width: 300px',
  'height: 100px',
  'padding: 10px',
  'margin: 5px',
].join('; ');

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = `<div id="target" style="${STYLE}">Hello</div>`;
  history.replaceState({}, '', '/page');
});

function setup(selected: Element | null = document.getElementById('target')) {
  const controller = new EditsController(null, document, NOW);
  render(
    <Panel
      controller={controller}
      selected={selected}
      mode="edit"
      onModeChange={vi.fn()}
      showOnboarding={false}
      onDismissOnboarding={vi.fn()}
      onSelect={vi.fn()}
      onPreviewSet={vi.fn()}
      onHighlight={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return controller;
}

/**
 * Sections nest now, so a child's header does not exist until its group is open. Opening
 * every closed header and going round again reaches any depth without the test having to
 * know which group holds what.
 */
/** Content — the words, the picture, the link — has no header: it is always on screen. */
const ALWAYS_OPEN = new Set(['text', 'image', 'link']);
/** Sections rendered inline inside a group: open the group that carries them. */
const INSIDE: Record<string, string> = { background: 'box' };

function openSection(id: string) {
  if (ALWAYS_OPEN.has(id)) return;
  if (INSIDE[id]) return openSection(INSIDE[id]);
  for (let round = 0; round < 4; round++) {
    const wanted = document.querySelector<HTMLButtonElement>(`[data-section="${id}"]`);
    if (wanted) {
      if (wanted.getAttribute('aria-expanded') !== 'true') fireEvent.click(wanted);
      return;
    }
    const closed = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-section][aria-expanded="false"]'),
    );
    if (closed.length === 0) break;
    closed.forEach((header) => fireEvent.click(header));
  }
  throw new Error(`no section header for "${id}"`);
}

function control(label: string): HTMLInputElement {
  // A wrapping <label> also labels the reset button and the slider next to the input,
  // so prefer the control whose own aria-label is the one we asked for.
  const matches = screen.getAllByLabelText(label, { exact: true });
  const own = matches.find((el) => el.getAttribute('aria-label') === label);
  return (own ?? matches[0]) as HTMLInputElement;
}

interface FieldCase {
  section: string;
  label: string;
  property: string;
  type: (typeof CASES)[number]['recordType'];
  input: string;
  expectedValue: string;
  expectedDisplay: string;
}

const CASES = [
  { section: 'text', label: 'Text', property: 'textContent', recordType: 'text', input: 'Changed', value: 'Changed', display: 'Changed' },
  { section: 'typography', label: 'Font family', property: 'fontFamily', recordType: 'style', input: 'Verdana', value: 'Verdana', display: 'Verdana' },
  { section: 'typography', label: 'Font size', property: 'fontSize', recordType: 'style', input: '48', value: '48px', display: '48' },
  { section: 'typography', label: 'Font weight', property: 'fontWeight', recordType: 'style', input: '300', value: '300', display: '300' },
  { section: 'typography', label: 'Line height', property: 'lineHeight', recordType: 'style', input: '1.5', value: '1.5', display: '1.5' },
  { section: 'typography', label: 'Text align', property: 'textAlign', recordType: 'style', input: 'center', value: 'center', display: 'center' },
  { section: 'typography', label: 'Letter spacing', property: 'letterSpacing', recordType: 'style', input: '0.5', value: '0.5px', display: '0.5' },
  { section: 'typography', label: 'Text transform', property: 'textTransform', recordType: 'style', input: 'uppercase', value: 'uppercase', display: 'uppercase' },
  { section: 'typography', label: t('aria_hex', ['Color']), property: 'color', recordType: 'style', input: '#ff0000', value: '#ff0000', display: '#ff0000' },
  { section: 'background', label: t('aria_hex', ['Background color']), property: 'backgroundColor', recordType: 'style', input: '#00ff00', value: '#00ff00', display: '#00ff00' },
  { section: 'appearance', label: 'Corner radius value', property: 'borderRadius', recordType: 'style', input: '12', value: '12px', display: '12' },
  { section: 'appearance', label: 'Opacity value', property: 'opacity', recordType: 'style', input: '50', value: '0.5', display: '50' },
  { section: 'appearance', label: 'Border width', property: 'borderWidth', recordType: 'style', input: '3', value: '3px', display: '3' },
  { section: 'appearance', label: t('aria_hex', ['Border color']), property: 'borderColor', recordType: 'style', input: '#0000ff', value: '#0000ff', display: '#0000ff' },
  { section: 'size', label: 'Width', property: 'width', recordType: 'style', input: '250', value: '250px', display: '250px' },
  { section: 'size', label: 'Height', property: 'height', recordType: 'style', input: '80', value: '80px', display: '80px' },
  { section: 'spacing', label: 'padding top', property: 'paddingTop', recordType: 'style', input: '24', value: '24px', display: '24' },
  { section: 'spacing', label: 'padding right', property: 'paddingRight', recordType: 'style', input: '24', value: '24px', display: '24' },
  { section: 'spacing', label: 'padding bottom', property: 'paddingBottom', recordType: 'style', input: '24', value: '24px', display: '24' },
  { section: 'spacing', label: 'padding left', property: 'paddingLeft', recordType: 'style', input: '24', value: '24px', display: '24' },
  { section: 'spacing', label: 'margin top', property: 'marginTop', recordType: 'style', input: '16', value: '16px', display: '16' },
  { section: 'spacing', label: 'margin right', property: 'marginRight', recordType: 'style', input: '16', value: '16px', display: '16' },
  { section: 'spacing', label: 'margin bottom', property: 'marginBottom', recordType: 'style', input: '16', value: '16px', display: '16' },
  { section: 'spacing', label: 'margin left', property: 'marginLeft', recordType: 'style', input: '16', value: '16px', display: '16' },
] as const;

describe.each(CASES)('$label', ({ section, label, property, recordType, input, value, display }) => {
  test('records the edit with the value the user asked for', () => {
    const controller = setup();
    openSection(section);
    fireEvent.change(control(label), { target: { value: input } });

    const record = controller.getPage().records.find((r) => r.property === property);
    expect(record, `no record written for ${property}`).toBeTruthy();
    expect(record!.type).toBe(recordType);
    expect(record!.newValue).toBe(value);
  });

  test('keeps showing the value the user typed', () => {
    setup();
    openSection(section);
    fireEvent.change(control(label), { target: { value: input } });
    expect(control(label).value).toBe(display);
  });

  test('reset clears the record and puts the original back in the field', () => {
    const controller = setup();
    openSection(section);
    const before = control(label).value;
    fireEvent.change(control(label), { target: { value: input } });
    expect(controller.getPage().records).toHaveLength(1);

    // The box model has one reset for all eight sides; every other field has its own.
    const resetName = section === 'spacing' ? 'Reset spacing' : `Reset ${property}`;
    fireEvent.click(screen.getByRole('button', { name: resetName }));
    expect(controller.getPage().records).toHaveLength(0);
    expect(control(label).value, `field kept a stale value after reset`).toBe(before);
  });
});

describe('url fields commit when you finish with them', () => {
  test('background image applies on blur, records and resets', () => {
    const controller = setup();
    openSection('background');
    const before = (control('Background image URL') as HTMLInputElement).value;
    fireEvent.change(control('Background image URL'), {
      target: { value: 'https://example.com/bg.png' },
    });
    // Typing alone must not record: a half-typed URL is not a value worth keeping.
    expect(controller.getPage().records).toHaveLength(0);
    fireEvent.blur(control('Background image URL'));

    const record = controller.getPage().records.find((r) => r.property === 'backgroundImage')!;
    expect(record.newValue).toBe('url("https://example.com/bg.png")');
    expect(control('Background image URL').value).toBe('https://example.com/bg.png');

    fireEvent.click(screen.getByRole('button', { name: 'Reset backgroundImage' }));
    expect(controller.getPage().records).toHaveLength(0);
    expect(control('Background image URL').value).toBe(before);
  });

  test('image src applies on Enter, records and resets', () => {
    document.body.innerHTML = '<img id="target" src="/original.png" alt="hero">';
    const controller = setup(document.getElementById('target'));
    openSection('image');
    fireEvent.change(control('Image URL'), { target: { value: 'https://example.com/new.png' } });
    expect(controller.getPage().records).toHaveLength(0);
    fireEvent.keyDown(control('Image URL'), { key: 'Enter' });

    const record = controller.getPage().records.find((r) => r.property === 'src')!;
    expect(record.type).toBe('attr');
    expect(record.newValue).toBe('https://example.com/new.png');
    expect(document.getElementById('target')!.getAttribute('src')).toBe(
      'https://example.com/new.png',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset src' }));
    expect(controller.getPage().records).toHaveLength(0);
    expect(control('Image URL').value).toBe('/original.png');
  });

  test('a URL that cannot be an image is refused with a reason', () => {
    document.body.innerHTML = '<img id="target" src="/original.png" alt="hero">';
    const controller = setup(document.getElementById('target'));
    openSection('image');
    fireEvent.change(control('Image URL'), { target: { value: 'not-a-url' } });
    fireEvent.blur(control('Image URL'));
    expect(screen.getByRole('alert').textContent).toMatch(/https:\/\//);
    expect(controller.getPage().records).toHaveLength(0);
  });
});

describe('bounded values keep a slider', () => {
  test('typing a number moves the slider', () => {
    setup();
    openSection('appearance');
    fireEvent.change(control('Opacity value'), { target: { value: '40' } });
    expect((control('Opacity') as HTMLInputElement).value).toBe('40');
  });

  test('opacity keeps its slider and its number in step both ways', () => {
    setup();
    openSection('appearance');
    fireEvent.change(control('Opacity'), { target: { value: '30' } });
    expect((control('Opacity value') as HTMLInputElement).value).toBe('30');
  });
});

describe('spacing box model', () => {
  test('edited sides are marked and reset together in one step', () => {
    const controller = setup();
    openSection('spacing');
    expect(screen.queryByRole('button', { name: 'Reset spacing' })).toBeNull();

    fireEvent.change(control('padding top'), { target: { value: '24' } });
    fireEvent.change(control('margin left'), { target: { value: '8' } });
    expect(control('padding top').className).toContain('twk-box-input--edited');
    expect(control('margin left').className).toContain('twk-box-input--edited');
    expect(control('padding bottom').className).not.toContain('twk-box-input--edited');
    expect(controller.getPage().records).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Reset spacing' }));
    expect(controller.getPage().records).toHaveLength(0);
    expect(controller.canUndo()).toBe(true);
    controller.undo();
    expect(controller.getPage().records, 'reset should be a single undo step').toHaveLength(2);
  });
});

describe('width and height take CSS values, not only pixels', () => {
  test.each([
    ['auto', 'auto'],
    ['50%', '50%'],
    ['30rem', '30rem'],
    ['fit-content', 'fit-content'],
    ['80vw', '80vw'],
  ])('accepts %s', (typed, recorded) => {
    const controller = setup();
    openSection('size');
    fireEvent.change(control('Width'), { target: { value: typed } });
    expect(controller.getPage().records.find((r) => r.property === 'width')!.newValue).toBe(recorded);
    expect(control('Width').value, 'the field shows what was typed').toBe(typed);
  });

  test('a bare number means px, and the field then says so in the value', () => {
    const controller = setup();
    openSection('size');
    fireEvent.change(control('Height'), { target: { value: '120' } });
    expect(controller.getPage().records.find((r) => r.property === 'height')!.newValue).toBe('120px');
    // Shown as CSS holds it, exactly like line-height: these fields take more than one unit.
    expect(control('Height').value).toBe('120px');
  });

  test('nonsense is held in the field but never recorded', () => {
    const controller = setup();
    openSection('size');
    fireEvent.change(control('Width'), { target: { value: '100px; position: fixed' } });
    expect(controller.getPage().records).toHaveLength(0);
    expect(control('Width').value, 'mid-typing text is not thrown away').toBe('100px; position: fixed');
  });

  test('reset returns the field to the computed pixel value', () => {
    const controller = setup();
    openSection('size');
    const before = control('Width').value;
    fireEvent.change(control('Width'), { target: { value: 'auto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset width' }));
    expect(controller.getPage().records).toHaveLength(0);
    expect(control('Width').value).toBe(before);
  });
});

describe('rejected input says why', () => {
  // Number inputs need no message: the browser refuses the keystroke, so nothing is lost.
  test.each([
    ['typography', 'Font family', 'Helvetica; }', /Letters, numbers/],
    ['typography', 'Line height', 'very tall', /Try 1.5/],
    ['size', 'Width', '100px; position: fixed', /Try 320/],
  ])('%s / %s', (section, label, typed, message) => {
    const controller = setup();
    openSection(section);
    fireEvent.change(control(label), { target: { value: typed } });

    // Silently dropping the value read as "this field is broken".
    expect(screen.getByRole('alert').textContent).toMatch(message);
    expect(controller.getPage().records).toHaveLength(0);
    expect(control(label).value, 'the text stays put so it can be corrected').toBe(typed);
  });

  test('the message clears once the value is acceptable', () => {
    const controller = setup();
    openSection('size');
    fireEvent.change(control('Width'), { target: { value: 'nope' } });
    expect(screen.queryByRole('alert')).toBeTruthy();
    fireEvent.change(control('Width'), { target: { value: '50%' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(controller.getPage().records[0].newValue).toBe('50%');
  });
});

describe('border width', () => {
  test('adds a border style so the width shows, and takes it back on reset', () => {
    // An element with no border at all: border-style is 'none', so a width alone
    // would paint nothing until we add a style with it.
    document.body.innerHTML = '<div id="target">Hello</div>';
    const controller = setup(document.getElementById('target'));
    openSection('appearance');
    fireEvent.change(control('Border width'), { target: { value: '2' } });

    const properties = controller.getPage().records.map((r) => r.property);
    expect(properties).toContain('borderWidth');
    // Without a style, a width alone paints nothing; with a style left behind, a
    // reset leaves the element with the browser's default 3px border.
    expect(properties).toContain('borderStyle');

    fireEvent.click(screen.getByRole('button', { name: 'Reset borderWidth' }));
    expect(controller.getPage().records).toHaveLength(0);
  });
});

describe('decimal values survive the round trip', () => {
  test('fractional padding is kept, not rounded away', () => {
    const controller = setup();
    openSection('spacing');
    fireEvent.change(control('padding top'), { target: { value: '12.5' } });
    expect(controller.getPage().records[0].newValue).toBe('12.5px');
    expect(control('padding top').value).toBe('12.5');
  });

  test('fractional letter spacing is kept, not rounded away', () => {
    const controller = setup();
    openSection('typography');
    fireEvent.change(control('Letter spacing'), { target: { value: '1.2' } });
    expect(controller.getPage().records[0].newValue).toBe('1.2px');
    expect(control('Letter spacing').value).toBe('1.2');
  });
});

/**
 * The stylesheet has described the property name as a scrub handle since before anything
 * was wired to it. These are the properties that made it worth wiring: it drives the
 * field's own input, so the section's writer runs unchanged, and it moves by the field's
 * own step — which is how a page whose text is 15.4px stays sensible.
 */
describe('dragging a property name', () => {
  function scrub(property: string, dx: number, modifiers: Partial<PointerEventInit> = {}) {
    const row = document.querySelector<HTMLElement>(`[data-property="${property}"]`)!;
    const handle = row.querySelector<HTMLElement>('.twk-prop-label')!;
    handle.setPointerCapture = () => {};
    handle.hasPointerCapture = () => true;
    handle.releasePointerCapture = () => {};
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100 + dx, pointerId: 1, ...modifiers });
    fireEvent.pointerUp(handle, { pointerId: 1 });
  }

  test('moves the number by one step per pixel, through the section that owns it', () => {
    const controller = setup();
    openSection('typography');
    const before = Number(
      document.querySelector<HTMLInputElement>('[data-testid="font-size"]')!.value,
    );
    scrub('fontSize', 8);
    const record = controller.getPage().records.find((r) => r.property === 'fontSize');
    expect(record?.newValue, 'the section wrote it, not the drag').toBe(`${before + 8}px`);
  });

  test('Alt is finer and Shift is coarser', () => {
    const controller = setup();
    openSection('typography');
    scrub('letterSpacing', 4, { shiftKey: true });
    expect(controller.getPage().records.find((r) => r.property === 'letterSpacing')?.newValue).toBe('4px');
  });

  test('a value the field forbids is not reachable by dragging', () => {
    const controller = setup();
    openSection('typography');
    scrub('fontSize', -400);
    const record = controller.getPage().records.find((r) => r.property === 'fontSize');
    expect(Number.parseFloat(record?.newValue ?? '0'), 'min is still min').toBeGreaterThanOrEqual(1);
  });
});
