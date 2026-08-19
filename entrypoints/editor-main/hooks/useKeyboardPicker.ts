import { useEffect } from 'react';
import { isTweakpageNode } from '../../../lib/edits/dom';
import { excludedBy } from '../../../lib/exclusions';
import { isTextEntry } from './useUndoRedoShortcuts';

interface KeyboardPickerOptions {
  enabled: boolean;
  selected: Element | null;
  onSelect: (el: Element) => void;
  /** The same rules the mouse obeys: two ways in must not mean one way around. */
  exclusions?: string[];
}

/** Skips the editor's own UI and anything with no box on screen. */
function isPickable(el: Element | null, host: HTMLElement, exclusions: string[] = []): boolean {
  if (!el || el === host || host.contains(el) || isTweakpageNode(el)) return false;
  if (el.getRootNode() !== el.ownerDocument) return false;
  if (excludedBy(el, exclusions)) return false;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function siblings(el: Element, host: HTMLElement, step: number, exclusions: string[]): Element | null {
  let cursor = step > 0 ? el.nextElementSibling : el.previousElementSibling;
  while (cursor && !isPickable(cursor, host, exclusions)) {
    cursor = step > 0 ? cursor.nextElementSibling : cursor.previousElementSibling;
  }
  return cursor;
}

/**
 * Moves the selection around the DOM with the arrow keys.
 *
 * Picking an element was mouse-only, which left keyboard users unable to select
 * anything at all. Alt keeps the arrows out of the way of the page's own shortcuts and
 * of scrolling.
 */
export function useKeyboardPicker(
  host: HTMLElement,
  { enabled, selected, onSelect, exclusions = [] }: KeyboardPickerOptions,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (isTextEntry(e.composedPath()[0] ?? e.target)) return;
      const doc = host.ownerDocument;
      const current = selected?.isConnected ? selected : null;

      let next: Element | null = null;
      if (e.key === 'ArrowUp') next = current?.parentElement ?? null;
      else if (e.key === 'ArrowDown') {
        next = current
          ? Array.from(current.children).find((c) => isPickable(c, host, exclusions)) ?? null
          : Array.from(doc.body.children).find((c) => isPickable(c, host, exclusions)) ?? null;
      } else if (e.key === 'ArrowRight') next = current ? siblings(current, host, 1, exclusions) : null;
      else if (e.key === 'ArrowLeft') next = current ? siblings(current, host, -1, exclusions) : null;
      else return;

      if (!next || !isPickable(next, host, exclusions)) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(next);
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [host, enabled, selected, onSelect, exclusions]);
}
