import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function clampPosition(pos: Position, size: Size, viewport: Size): Position {
  return {
    x: Math.min(Math.max(pos.x, 0), Math.max(viewport.width - size.width, 0)),
    y: Math.min(Math.max(pos.y, 0), Math.max(viewport.height - size.height, 0)),
  };
}

interface UseDraggableOptions {
  restoredPosition?: Position | null;
  onDragEnd?: (position: Position) => void;
}

export function useDraggable(
  targetRef: RefObject<HTMLElement | null>,
  { restoredPosition = null, onDragEnd }: UseDraggableOptions = {},
) {
  const [position, setPosition] = useState<Position | null>(null);
  const positionRef = useRef<Position | null>(null);
  const grabOffset = useRef<Position | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || !restoredPosition) return;
    restored.current = true;
    const rect = targetRef.current?.getBoundingClientRect();
    const size = rect ? { width: rect.width, height: rect.height } : { width: 320, height: 400 };
    const clamped = clampPosition(restoredPosition, size, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    positionRef.current = clamped;
    setPosition(clamped);
  }, [restoredPosition, targetRef]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if ((e.target as Element).closest('button, select, input')) return;
      const rect = targetRef.current?.getBoundingClientRect();
      if (!rect) return;
      grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [targetRef],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const offset = grabOffset.current;
      const rect = targetRef.current?.getBoundingClientRect();
      if (!offset || !rect) return;
      const next = clampPosition(
        { x: e.clientX - offset.x, y: e.clientY - offset.y },
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      positionRef.current = next;
      setPosition(next);
    },
    [targetRef],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const wasDragging = grabOffset.current !== null;
      grabOffset.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (wasDragging && positionRef.current && onDragEnd) onDragEnd(positionRef.current);
    },
    [onDragEnd],
  );

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: 'auto' }
    : undefined;

  return {
    style,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
