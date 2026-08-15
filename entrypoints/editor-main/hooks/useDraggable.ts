import {
  useCallback,
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

export function useDraggable(targetRef: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<Position | null>(null);
  const grabOffset = useRef<Position | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if ((e.target as Element).closest('button')) return;
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
      setPosition(
        clampPosition(
          { x: e.clientX - offset.x, y: e.clientY - offset.y },
          { width: rect.width, height: rect.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    },
    [targetRef],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    grabOffset.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

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
