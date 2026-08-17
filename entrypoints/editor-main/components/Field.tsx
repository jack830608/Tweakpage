import { useSyncExternalStore, type ReactNode } from 'react';
import type { EditsController } from '../controller';
import { isBareNumber } from '../../../lib/css-values';
import { ResetButton } from './ResetButton';

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
  return (
    <div className={stacked ? 'twk-field twk-field--stacked' : 'twk-field'}>
      <span className="twk-field-name">
        <ResetButton
          controller={controller}
          element={element}
          property={property}
          companions={companions}
        />
        <span className={modified ? 'twk-prop twk-prop--modified' : 'twk-prop'} title={name}>
          {name}
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
      {error && (
        <p className="twk-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

