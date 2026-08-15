import { useMemo, type ReactNode } from 'react';
import { pxToNumber } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];
type Kind = 'padding' | 'margin';

function propName(kind: Kind, side: Side): string {
  return `${kind}${side[0].toUpperCase()}${side.slice(1)}`;
}

export function SpacingSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    const snapshot: Record<string, string> = {};
    for (const kind of ['padding', 'margin'] as Kind[]) {
      for (const side of SIDES) {
        snapshot[propName(kind, side)] = s.getPropertyValue(`${kind}-${side}`);
      }
    }
    return snapshot;
  }, [element]);

  const field = (kind: Kind, side: Side): ReactNode => {
    const prop = propName(kind, side);
    return (
      <input
        key={prop}
        type="number"
        aria-label={`${kind} ${side}`}
        className={`pgve-box-input--${side}`}
        value={pxToNumber(cs.getPropertyValue(`${kind}-${side}`))}
        onChange={(e) => {
          if (e.target.value === '') return;
          controller.recordEdit(element, 'style', prop, original[prop], `${e.target.value}px`);
        }}
      />
    );
  };

  const rect = element.getBoundingClientRect();
  return (
    <section className="pgve-section">
      <div className="pgve-box pgve-box--margin">
        <span className="pgve-box-label">margin</span>
        {SIDES.map((side) => field('margin', side))}
        <div className="pgve-box pgve-box--padding">
          <span className="pgve-box-label">padding</span>
          {SIDES.map((side) => field('padding', side))}
          <div className="pgve-box-center">
            {Math.round(rect.width)}×{Math.round(rect.height)}
          </div>
        </div>
      </div>
    </section>
  );
}
