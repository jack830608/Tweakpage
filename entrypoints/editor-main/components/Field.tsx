import { useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { EditsController } from '../controller';
import { ResetButton } from './ResetButton';
import { t } from '../../../lib/i18n';

interface FieldProps {
  /** The CSS property as the user sees it, e.g. "font-size". */
  name: string;
  property: string;
  controller: EditsController;
  element: Element;
  companions?: string[];
  /** Put the control on its own row below the name — for full-width controls. */
  stacked?: boolean;
  /** Shown under the row when the typed value was refused. */
  error?: string | null;
  /** The unit a bare number means here, printed inside the control. */
  unit?: string;
  /** Makes the property name a scrub handle; called with whole steps dragged. */
  onScrub?: (steps: number) => void;
  children: ReactNode;
}

/**
 * One row: the property name with a reset gutter on the left, the control on the right.
 *
 * The reset lives in the name column rather than in a column of its own — a reserved
 * column on the right stole width from every control to hold a button that is usually
 * absent. It is a <div>, not a <label>: a label hands clicks to its first form control,
 * which would be the reset button, and every control here already carries an aria-label.
 */
export function Field({
  name,
  property,
  controller,
  element,
  companions,
  stacked,
  error,
  unit,
  onScrub,
  children,
}: FieldProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const modified = controller.recordFor(element, property) !== undefined;
  return (
    <div className={stacked ? 'pgve-field pgve-field--stacked' : 'pgve-field'}>
      <span className="pgve-field-name">
        <ResetButton
          controller={controller}
          element={element}
          property={property}
          companions={companions}
        />
        <span
          className={[
            'pgve-prop',
            modified ? 'pgve-prop--modified' : '',
            onScrub ? 'pgve-prop--scrub' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={onScrub ? t('tip_scrub', [name]) : name}
          onPointerDown={onScrub ? (e) => startScrub(e, onScrub) : undefined}
        >
          {name}
        </span>
      </span>
      {unit ? (
        <span className="pgve-unit-wrap">
          {children}
          <span className="pgve-unit" aria-hidden="true">{unit}</span>
        </span>
      ) : (
        children
      )}
      {error && (
        <p className="pgve-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Pixels of travel per step — loose enough to be controllable on a trackpad. */
const SCRUB_PIXELS = 4;

/**
 * Drag the property name to change its value.
 *
 * This replaces the native spinner, which only appeared on hover, sat on top of the
 * unit label, and gave no way to move quickly through a range.
 */
function startScrub(e: ReactPointerEvent<HTMLElement>, onScrub: (steps: number) => void): void {
  e.preventDefault();
  const startX = e.clientX;
  let applied = 0;
  const move = (ev: PointerEvent) => {
    const steps = Math.trunc((ev.clientX - startX) / SCRUB_PIXELS);
    if (steps === applied) return;
    onScrub(steps - applied);
    applied = steps;
  };
  const stop = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', stop);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', stop);
}
