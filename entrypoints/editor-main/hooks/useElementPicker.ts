import { useEffect } from 'react';
import { isTweakpageNode } from '../../../lib/edits/dom';
import { excludedBy } from '../../../lib/exclusions';
import { t } from '../../../lib/i18n';
import { isTextEntry } from './useUndoRedoShortcuts';

export interface PickerCallbacks {
  /**
   * The second argument says why this element is refused, when it is. Refusing silently
   * is indistinguishable from a picker that has stopped working.
   */
  onHover: (el: Element | null, refusal?: string | null) => void;
  onSelect: (el: Element) => void;
  onEscape: () => void;
}

export function eventTargetElement(e: Event, host: HTMLElement): Element | null {
  const path = e.composedPath();
  if (path.includes(host)) return null;
  // The whole path, not the target: the on-page marker draws itself in a shadow root of
  // its own, and closest() cannot see out of one. Testing only the target left the chip
  // looking like part of the page — refused as unreachable, its click swallowed with it.
  if (path.some((node) => node instanceof Element && isTweakpageNode(node))) return null;
  const target = path[0] ?? e.target;
  return target instanceof Element ? target : null;
}

/**
 * Why this element cannot be picked, or null.
 *
 * A shadow root is not reachable by document.querySelector, so a record made inside one
 * can never be replayed. It used to select and accept an edit and then quietly do
 * nothing, with only a line in the change list to explain — the same treatment an iframe
 * gets, said at the moment it matters instead of afterwards.
 */
function refusalFor(el: Element, exclusions: string[]): string | null {
  if (el.getRootNode() !== el.ownerDocument) return t('outline_shadow');
  const rule = excludedBy(el, exclusions);
  return rule ? t('outline_excluded', [rule]) : null;
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
      onHover(el, el && refusalFor(el, exclusions));
    };
    const onClick = (e: MouseEvent) => {
      if (!enabled || e.altKey) return;
      const el = eventTargetElement(e, host);
      if (!el) return;
      // Swallowed either way: in edit mode a click is never the page's, and letting an
      // excluded region keep its own click could navigate away mid-session.
      e.preventDefault();
      e.stopPropagation();
      if (refusalFor(el, exclusions)) return;
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
