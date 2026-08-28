import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { EditsController } from '../controller';
import { isBareNumber } from '../../../lib/css-values';
import { ResetButton } from './ResetButton';
import { useScrub } from '../hooks/useScrub';
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
  /**
   * What the control currently shows. Field needs it because the unit rule depends on the
   * shape of the value rather than on which field it is: a bare number gets its unit
   * stated, a value carrying its own unit or keyword (24px, auto, 50%) does not.
   */
  value?: string;
  /** The unit a bare number means here. Omitted when the property has none, like line-height. */
  unit?: string;
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
  value,
  unit,
  children,
}: FieldProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const modified = controller.recordFor(element, property) !== undefined;
  const shownUnit = value !== undefined && isBareNumber(value) ? unit : undefined;
  // t() answers with the key when it has no translation, so a name nobody has written a
  // label for falls back to the CSS property rather than printing "prop_font-size".
  // Chrome message names allow [A-Za-z0-9_@] only. A hyphen in the key made the whole
  // messages.json invalid, and an extension whose locale will not parse does not start
  // its service worker at all — every end-to-end test timed out waiting for one.
  const key = `prop_${name.replace(/-/g, '_')}`;
  const translated = t(key) === key ? null : t(key);
  const row = useRef<HTMLDivElement>(null);
  const scrub = useScrub(row);
  return (
    /* The one hook the style summary needs: something to scroll to. */
    <div
      ref={row}
      className={stacked ? 'twk-field twk-field--stacked' : 'twk-field'}
      data-property={property}
    >
      <span className="twk-field-name">
        <ResetButton
          controller={controller}
          element={element}
          property={property}
          companions={companions}
        />
        {/*
          * What it does, then what it is called.
          *
          * The panel used to show only the CSS name, which asks somebody who does not
          * write CSS to already know that "letter-spacing" is the gap between letters —
          * exactly the knowledge this product exists to not require. The CSS name stays,
          * quieter, because the hand-off is written in it and a reader should be able to
          * connect the two. The change list an engineer receives is unchanged.
          */}
        <span className="twk-prop-names" title={name}>
          {/* Drag it sideways to change the number. The input remains the accessible
              control — this adds a pointer affordance, not a second one. */}
          <span
            className={modified ? 'twk-prop-label twk-prop--modified' : 'twk-prop-label'}
            data-scrub={scrub.scrubbable() ? '' : undefined}
            onPointerDown={scrub.onPointerDown}
            onPointerMove={scrub.onPointerMove}
            onPointerUp={scrub.onPointerUp}
            onPointerCancel={scrub.onPointerCancel}
          >
            {translated ?? name}
          </span>
          {/*
            * The second line is the CSS name, and while a value is refused it is the
            * message instead.
            *
            * The message used to be its own row under the field, which pushed every field
            * below it down — while you were typing, which is exactly when it appears.
            * Reserving that row under all eight type fields would be 136px of nothing.
            * The label column is already two lines, and the least critical text in the
            * row is the one that can stand aside for the most critical.
            */}
          {error ? (
            <span className="twk-prop twk-prop-error" role="alert">{error}</span>
          ) : (
            translated && <span className="twk-prop" aria-hidden="true">{name}</span>
          )}
        </span>
      </span>
      {shownUnit ? (
        <span className="twk-unit-wrap">
          {children}
          <span className="twk-unit" aria-hidden="true">{shownUnit}</span>
        </span>
      ) : (
        children
      )}
    </div>
  );
}

