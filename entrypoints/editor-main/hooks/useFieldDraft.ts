import { useState, useSyncExternalStore } from 'react';
import type { EditsController } from '../controller';

export interface FieldDraft {
  /** what the input should display right now */
  value: string;
  /**
   * What the page actually holds — the record if there is one, the computed value if
   * not. Distinct from `value`, which includes whatever is being typed and not yet
   * committed; a control that swaps itself out mid-keystroke never gets to commit.
   */
  applied: string;
  /** the pre-edit value to hand to recordEdit as oldValue */
  original: string;
  /** hold text the user is part-way through typing */
  setDraft: (next: string) => void;
  /** why the current text was not recorded, if it wasn't */
  error: string | null;
  /** say why a value was rejected instead of dropping it in silence */
  reject: (reason: string | null) => void;
}

const sameText = (a: string, b: string) => a === b;

/** For numeric fields, so typing "1." isn't yanked back to "1" mid-keystroke. */
export const sameNumber = (a: string, b: string) => Number(a) === Number(b);

/**
 * Reads a field's display value from our own edit record first, and only falls
 * back to getComputedStyle when the property is untouched.
 *
 * Deriving the display value from computed style alone breaks in three ways:
 * a reset leaves the old text sitting in the input, decimals get rounded away
 * on the way back (0.1px reads as 0), and shorthand/keyword values ("normal")
 * come back in a form the user never typed.
 */
export function useFieldDraft(
  controller: EditsController,
  element: Element,
  property: string,
  computed: string,
  format: (raw: string) => string = (raw) => raw,
  equals: (a: string, b: string) => boolean = sameText,
): FieldDraft {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const record = controller.recordFor(element, property);
  const authoritative = format(record ? record.newValue : computed);

  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState({ element, value: authoritative });
  if (synced.element !== element || synced.value !== authoritative) {
    setSynced({ element, value: authoritative });
    // Keep the draft when this change is the echo of what the user just typed;
    // drop it when the value moved for any other reason (reset, undo, new element).
    if (draft === null || !equals(draft, authoritative)) {
      setDraft(null);
      setError(null);
    }
  }

  return {
    value: draft ?? authoritative,
    applied: authoritative,
    original: record?.oldValue ?? computed,
    setDraft: (next: string) => {
      setDraft(next);
      setError(null);
    },
    error,
    reject: setError,
  };
}
