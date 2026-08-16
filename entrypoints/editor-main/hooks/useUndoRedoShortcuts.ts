import { useEffect } from 'react';

interface UndoRedoTarget {
  undo: () => void;
  redo: () => void;
}

/** Text fields have their own undo stack; everything else is ours. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return /^(input|textarea)$/i.test(target.tagName);
}

export function useUndoRedoShortcuts(_host: HTMLElement, controller: UndoRedoTarget): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      // Skipping every key inside the panel meant undo was dead exactly after a click,
      // which is when it is needed most — most of all after Revert all.
      if (isTextEntry(e.composedPath()[0] ?? e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) controller.redo();
      else controller.undo();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [controller]);
}
