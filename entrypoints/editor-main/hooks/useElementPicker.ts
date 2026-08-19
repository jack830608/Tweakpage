import { useEffect } from 'react';
import { isTweakpageNode } from '../../../lib/edits/dom';
import { excludedBy } from '../../../lib/exclusions';
import { isTextEntry } from './useUndoRedoShortcuts';

export interface PickerCallbacks {
  /**
   * The second argument names the rule refusing this element, when one does. Refusing
   * silently is indistinguishable from a picker that has stopped working.
   */
  onHover: (el: Element | null, refusedBy?: string | null) => void;
  onSelect: (el: Element) => void;
  onEscape: () => void;
}

export function eventTargetElement(e: Event, host: HTMLElement): Element | null {
  const path = e.composedPath();
  if (path.includes(host)) return null;
  const target = path[0] ?? e.target;
  if (!(target instanceof Element)) return null;
  // The on-page marker is ours too: offering to edit it would record UI that is not in
  // the page and will not exist on the next load.
  return isTweakpageNode(target) ? null : target;
}

export function useElementPicker(
  host: HTMLElement,
  enabled: boolean,
  { onHover, onSelect, onEscape }: PickerCallbacks,
  exclusions: string[] = [],
): void {
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!enabled) return;
      if (e.altKey) {
        onHover(null);
        return;
      }
      const el = eventTargetElement(e, host);
      onHover(el, el && excludedBy(el, exclusions));
    };
    const onClick = (e: MouseEvent) => {
      if (!enabled || e.altKey) return;
      const el = eventTargetElement(e, host);
      if (!el) return;
      // Swallowed either way: in edit mode a click is never the page's, and letting an
      // excluded region keep its own click could navigate away mid-session.
      e.preventDefault();
      e.stopPropagation();
      if (excludedBy(el, exclusions)) return;
      onSelect(el);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.composedPath()[0] ?? e.target;
      // Escape out of a field first; a second press then leaves the selection.
      if (isTextEntry(target)) {
        (target as HTMLElement).blur();
        return;
      }
      e.preventDefault();
      onEscape();
    };
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [host, enabled, onHover, onSelect, onEscape, exclusions]);
}
