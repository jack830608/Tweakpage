import { useEffect, useState } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';

interface OverlayProps {
  hovered: Element | null;
  selected: Element | null;
  /** Elements carrying edits, outlined faintly so a reopened page shows its history. */
  edited?: Element[];
}

export function Overlay({ hovered, selected, edited = [] }: OverlayProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <>
      {edited.map((el, i) =>
        el === selected || el === hovered ? null : (
          <div
            key={i}
            className="pgve-edited-mark"
            style={boxOf(el)}
            data-testid="edited-mark"
            aria-hidden="true"
          />
        ),
      )}
      {hovered && hovered !== selected && <OutlineBox el={hovered} kind="hover" />}
      {selected && <OutlineBox el={selected} kind="selected" />}
    </>
  );
}

function boxOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function OutlineBox({ el, kind }: { el: Element; kind: 'hover' | 'selected' }) {
  const r = el.getBoundingClientRect();
  const label =
    el.tagName === 'IFRAME'
      ? 'iframe — not supported'
      : `${buildElementLabel(el)} · ${Math.round(r.width)}×${Math.round(r.height)}`;
  return (
    <div
      className={`pgve-outline pgve-outline--${kind}`}
      style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
    >
      <span className="pgve-outline-label">{label}</span>
    </div>
  );
}
