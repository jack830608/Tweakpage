import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Panel } from '../Panel';
import { EditsController } from '../../controller';

/**
 * One rule, checked against every field.
 *
 * A field either has a single possible unit, in which case it shows a bare number and
 * states that unit; or it takes several forms, in which case it shows exactly what CSS
 * holds and states nothing. Whether the name can be dragged follows from the same
 * question: a bare number can be scrubbed, a value carrying its own unit cannot.
 *
 * A slider is separate and rarer: it needs a real range to point at. Opacity has one,
 * 0 to 100. Corner radius does not — its slider was capped at an invented 64, so a card
 * with a 200px radius sat pinned at the end of a track that was lying about the value.
 *
 * The behaviour used to be decided field by field, which is how line-height came to show
 * "24px" while width showed "1104" with a separate px chip — the same kind of field
 * behaving two different ways. This table is the answer to that: adding a field means
 * adding a row here.
 */
const NOW = () => '2026-08-16T10:00:00.000Z';

type Kind = 'fixed-unit' | 'free-form' | 'choice' | 'text';

interface FieldRule {
  section: string;
  testid: string;
  kind: Kind;
  /** For fixed-unit fields: the unit the bare number is in. */
  unit?: string;
  /** A value that carries its own unit or keyword, for the free-form fields. */
  unitful?: string;
  /** Only for values with a real range — a slider needs somewhere to point. */
  slider?: true;
}

const FIELDS: FieldRule[] = [
  { section: 'typography', testid: 'font-size', kind: 'fixed-unit', unit: 'px' },
  { section: 'typography', testid: 'letter-spacing', kind: 'fixed-unit', unit: 'px' },
  { section: 'typography', testid: 'line-height', kind: 'free-form', unitful: '24px' },
  { section: 'typography', testid: 'font-family', kind: 'text' },
  { section: 'typography', testid: 'font-weight', kind: 'choice' },
  { section: 'typography', testid: 'text-align', kind: 'choice' },
  { section: 'typography', testid: 'text-transform', kind: 'choice' },
  { section: 'appearance', testid: 'corner-radius-value', kind: 'fixed-unit', unit: 'px' },
  { section: 'appearance', testid: 'opacity-value', kind: 'fixed-unit', unit: '%', slider: true },
  { section: 'appearance', testid: 'border-width', kind: 'fixed-unit', unit: 'px' },
  { section: 'size', testid: 'width', kind: 'free-form', unitful: 'auto' },
  { section: 'size', testid: 'height', kind: 'free-form', unitful: '50%' },
  { section: 'layout', testid: 'gap', kind: 'fixed-unit', unit: 'px' },
  { section: 'layout', testid: 'display', kind: 'choice' },
  { section: 'layout', testid: 'position', kind: 'choice' },
  { section: 'layout', testid: 'box-shadow', kind: 'text' },
  { section: 'background', testid: 'background-image-url', kind: 'text' },
];

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML =
    '<div id="target" style="display: flex; gap: 8px; font-size: 32px; line-height: 40px; ' +
    'width: 300px; height: 100px; border-radius: 4px; opacity: 1; border: 0px solid #000">Hello</div>';
  history.replaceState({}, '', '/page');
});

function setup() {
  render(
    <Panel
      controller={new EditsController(null, document, NOW)}
      selected={document.getElementById('target')}
      mode="edit"
      onModeChange={vi.fn()}
      showOnboarding={false}
      onDismissOnboarding={vi.fn()}
      onSelect={vi.fn()}
      onHighlight={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  for (const id of new Set(FIELDS.map((f) => f.section))) {
    const header = document.querySelector<HTMLButtonElement>(`[data-section="${id}"]`);
    if (header && header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  }
}

function control(testid: string): HTMLInputElement {
  const el = document.querySelector(`[data-testid="${testid}"]`);
  if (!el) throw new Error(`no control for "${testid}" — is the rules table out of date?`);
  return el as HTMLInputElement;
}

function row(testid: string): Element {
  const el = control(testid).closest('.pgve-field');
  if (!el) throw new Error(`"${testid}" is not in a field row`);
  return el;
}

const unitOf = (testid: string) => row(testid).querySelector('.pgve-unit')?.textContent ?? null;
const sliderIn = (testid: string) => row(testid).querySelector('input[type="range"]');
const scrubHandle = (testid: string) => row(testid).querySelector('.pgve-prop--scrub');

describe.each(FIELDS)('$testid ($kind)', (field) => {
  test('states its unit only when the number on screen is bare', () => {
    setup();
    const shown = control(field.testid).value;
    const bare = /^-?\d*\.?\d+$/.test(shown);

    if (field.kind === 'fixed-unit') {
      expect(bare, `${field.testid} should show a bare number`).toBe(true);
      expect(unitOf(field.testid)).toBe(field.unit);
    } else {
      expect(unitOf(field.testid), 'only a fixed unit may be claimed').toBeNull();
    }
  });

  test('offers dragging exactly when the value is a bare number', () => {
    setup();
    const bare = /^-?\d*\.?\d+$/.test(control(field.testid).value);
    const draggable = scrubHandle(field.testid) !== null;
    if (field.kind === 'choice' || field.kind === 'text') {
      expect(draggable, 'nothing to count up or down here').toBe(false);
    } else {
      expect(draggable).toBe(bare);
    }
  });

  test('has a slider only if its value has a real range', () => {
    setup();
    const hasSlider = sliderIn(field.testid) !== null;
    expect(hasSlider, field.slider ? 'a bounded value should offer one' : 'nothing to point at').toBe(
      field.slider === true,
    );
  });

  test('is reachable and labelled', () => {
    setup();
    const el = control(field.testid);
    expect(el.getAttribute('aria-label')).toBeTruthy();
    expect(row(field.testid).querySelector('.pgve-prop')).toBeTruthy();
  });
});

describe('free-form fields behave the same as each other', () => {
  test('a value carrying its own unit is shown as CSS holds it, with no chip and no drag', () => {
    setup();
    for (const field of FIELDS.filter((f) => f.kind === 'free-form')) {
      fireEvent.change(control(field.testid), { target: { value: field.unitful! } });
      expect(control(field.testid).value, field.testid).toBe(field.unitful);
      expect(unitOf(field.testid), field.testid).toBeNull();
      expect(scrubHandle(field.testid), `${field.testid} cannot be counted up or down`).toBeNull();
    }
  });

  test('a bare ratio in line-height can still be dragged', () => {
    setup();
    fireEvent.change(control('line-height'), { target: { value: '1.5' } });
    expect(scrubHandle('line-height')).toBeTruthy();
    expect(unitOf('line-height'), 'a ratio has no unit to state').toBeNull();
  });
});
