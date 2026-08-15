import { useEffect } from 'react';

export interface PickerCallbacks {
  onHover: (el: Element | null) => void;
  onSelect: (el: Element) => void;
  onEscape: () => void;
}

export function eventTargetElement(e: Event, host: HTMLElement): Element | null {
  const path = e.composedPath();
  if (path.includes(host)) return null;
  const target = path[0] ?? e.target;
  return target instanceof Element ? target : null;
}

export function useElementPicker(
  host: HTMLElement,
  { onHover, onSelect, onEscape }: PickerCallbacks,
): void {
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onHover(eventTargetElement(e, host));
    const onClick = (e: MouseEvent) => {
      const el = eventTargetElement(e, host);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(el);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.composedPath().includes(host)) return;
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
  }, [host, onHover, onSelect, onEscape]);
}
