import { useEffect, useState, type ReactNode } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';
import { t } from '../../../lib/i18n';

interface OverlayProps {
  hovered: Element | null;
  /**
   * Why the hovered element cannot be picked, if it cannot. The outline says it — an
   * element that simply will not highlight reads as a broken picker, and the reason is
   * the one piece of information that makes it actionable.
   */
  refusal?: string | null;
  selected: Element | null;
  /** Elements carrying edits, outlined faintly so a reopened page shows its history. */
  edited?: Element[];
  /**
   * A set about to be acted on, shown while the pointer is over the control that would
   * act on it. Ticking "apply to all 41 similar elements" restyled forty elements the
   * user had never been shown.
   */
  preview?: Element[];
  /** Whether the selected element can swap with a sibling in that direction. */
  canMove?: (el: Element, direction: -1 | 1) => boolean;
  onMove?: (el: Element, direction: -1 | 1) => void;
  /** The element currently being edited in place, if any. */
  editing?: Element | null;
}

export function Overlay({
  hovered,
  refusal,
  selected,
  edited = [],
  preview = [],
  canMove,
  onMove,
  editing,
}: OverlayProps) {
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
      {preview.map((el, i) => (
        <div key={`p${i}`} className="twk-preview-mark" style={boxOf(el)} aria-hidden="true" />
      ))}
      {hovered && hovered !== selected && (
        <OutlineBox
          el={hovered}
          kind={refusal ? 'excluded' : 'hover'}
          label={refusal ?? undefined}
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
  const named = buildElementLabel(el);
  // The quoted words first. They are the only part of this a person who did not write
  // the page can match to what they are looking at; the tag and the id are for whoever
  // receives the hand-off, and they were arriving first.
  const quoted = named.match(/"(.*)"$/)?.[1];
  const label =
    given ??
    (el.tagName === 'IFRAME'
      ? 'iframe — not supported'
      : `${quoted ? `"${quoted}" · ` : ''}${quoted ? named.slice(0, named.indexOf(' "')) : named} · ${Math.round(r.width)}×${Math.round(r.height)}`);
  // Above by default, below when there is no room above — an element near the top of the
  // viewport had its label rendered off-screen entirely. Held inside the left edge for
  // the same reason: anchored at the element's left, an element starting off-screen
  // took its label with it.
  const below = r.top < 30;
  return (
    <div
      className={`twk-outline twk-outline--${kind}`}
      style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
    >
      {/* Anchored left — the right edge is where the panel floats, and buttons under the
          panel cannot be clicked. */}
      <span
        className="twk-outline-top"
        style={{
          top: below ? '100%' : undefined,
          marginTop: below ? 6 : undefined,
          left: Math.max(0, 6 - r.left),
        }}
      >
        <span className="twk-outline-label">{label}</span>
        {children}
      </span>
    </div>
  );
}
