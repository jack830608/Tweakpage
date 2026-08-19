import { useEffect, useState, type ReactNode } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';
import { t } from '../../../lib/i18n';

interface OverlayProps {
  hovered: Element | null;
  /**
   * The exclusion rule refusing the hovered element, if one does. The outline says so
   * and names it — an element that simply will not highlight reads as a broken picker,
   * and the rule that did it is the one piece of information that makes it fixable.
   */
  refusedBy?: string | null;
  selected: Element | null;
  /** Elements carrying edits, outlined faintly so a reopened page shows its history. */
  edited?: Element[];
  /** Whether the selected element can swap with a sibling in that direction. */
  canMove?: (el: Element, direction: -1 | 1) => boolean;
  onMove?: (el: Element, direction: -1 | 1) => void;
  /** The element currently being edited in place, if any. */
  editing?: Element | null;
}

export function Overlay({ hovered, refusedBy, selected, edited = [], canMove, onMove, editing }: OverlayProps) {
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
            className="twk-edited-mark"
            style={boxOf(el)}
            data-testid="edited-mark"
            aria-hidden="true"
          />
        ),
      )}
      {hovered && hovered !== selected && (
        <OutlineBox
          el={hovered}
          kind={refusedBy ? 'excluded' : 'hover'}
          label={refusedBy ? t('outline_excluded', [refusedBy]) : undefined}
        />
      )}
      {selected && (
        <OutlineBox el={selected} kind={selected === editing ? 'editing' : 'selected'}>
          {selected !== editing && onMove && canMove && (canMove(selected, -1) || canMove(selected, 1)) && (
            <span className="twk-move-buttons">
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

function OutlineBox({
  el,
  kind,
  label: given,
  children,
}: {
  el: Element;
  kind: 'hover' | 'selected' | 'editing' | 'excluded';
  label?: string;
  children?: ReactNode;
}) {
  const r = el.getBoundingClientRect();
  const label =
    given ??
    (el.tagName === 'IFRAME'
      ? 'iframe — not supported'
      : `${buildElementLabel(el)} · ${Math.round(r.width)}×${Math.round(r.height)}`);
  return (
    <div
      className={`twk-outline twk-outline--${kind}`}
      style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
    >
      {/* One bar above the box, anchored left — the right edge is where the panel
          floats, and buttons under the panel cannot be clicked. */}
      <span className="twk-outline-top">
        <span className="twk-outline-label">{label}</span>
        {children}
      </span>
    </div>
  );
}
