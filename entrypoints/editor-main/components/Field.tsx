import { useSyncExternalStore, type ReactNode } from 'react';
import type { EditsController } from '../controller';
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
        <span className={modified ? 'pgve-prop pgve-prop--modified' : 'pgve-prop'} title={name}>
          {name}
        </span>
      </span>
      {children}
    </div>
  );
}
