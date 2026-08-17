import { useEffect, useState, type ReactNode } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';
import { t } from '../../../lib/i18n';

interface OverlayProps {
  hovered: Element | null;
  selected: Element | null;
  /** Elements carrying edits, outlined faintly so a reopened page shows its history. */
  edited?: Element[];
  /** Whether the selected element can swap with a sibling in that direction. */
  canMove?: (el: Element, direction: -1 | 1) => boolean;
  onMove?: (el: Element, direction: -1 | 1) => void;
}

export function Overlay({ hovered, selected, edited = [], canMove, onMove }: OverlayProps) {
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
      {selected && (
        <OutlineBox el={selected} kind="selected">
          {onMove && canMove && (canMove(selected, -1) || canMove(selected, 1)) && (
            <span className="pgve-move-buttons">
              <button
                type="button"
                aria-label={t('aria_move_up')}
                title={t('tip_move_up')}
                data-testid="move-up"
                disabled={!canMove(selected, -1)}
                onClick={() => onMove(selected, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={t('aria_move_down')}
                title={t('tip_move_down')}
                data-testid="move-down"
                disabled={!canMove(selected, 1)}
                onClick={() => onMove(selected, 1)}
              >
                ▼
              </button>
            </span>
          )}
        </OutlineBox>
      )}
    </>
  );
}

function boxOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function OutlineBox({ el, kind, children }: { el: Element; kind: 'hover' | 'selected'; children?: ReactNode }) {
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
      {/* One bar above the box, anchored left — the right edge is where the panel
          floats, and buttons under the panel cannot be clicked. */}
      <span className="pgve-outline-top">
        <span className="pgve-outline-label">{label}</span>
        {children}
      </span>
    </div>
  );
}
