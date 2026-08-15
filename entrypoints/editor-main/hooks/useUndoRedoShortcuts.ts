import { useEffect } from 'react';

interface UndoRedoTarget {
  undo: () => void;
  redo: () => void;
}

export function useUndoRedoShortcuts(host: HTMLElement, controller: UndoRedoTarget): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      if (e.composedPath().includes(host)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) controller.redo();
      else controller.undo();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [host, controller]);
}
