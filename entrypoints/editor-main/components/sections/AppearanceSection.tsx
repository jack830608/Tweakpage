import { useMemo } from 'react';
import { pxToNumber } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ResetButton } from '../ResetButton';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function AppearanceSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    return {
      borderRadius: s.getPropertyValue('border-top-left-radius'),
      opacity: s.opacity,
    };
  }, [element]);
  return (
    <section className="pgve-section">
      <label>
        Corner radius
        <input
          type="number"
          min={0}
          aria-label="Corner radius"
          value={pxToNumber(cs.getPropertyValue('border-top-left-radius'))}
          onChange={(e) => {
            if (e.target.value === '') return;
            controller.recordEdit(element, 'style', 'borderRadius', original.borderRadius, `${e.target.value}px`);
          }}
        />
        <ResetButton controller={controller} element={element} property="borderRadius" />
      </label>
      <label>
        Opacity
        <input
          type="number"
          min={0}
          max={100}
          aria-label="Opacity"
          value={Math.round(Number.parseFloat(cs.opacity || '1') * 100)}
          onChange={(e) => {
            if (e.target.value === '') return;
            const percent = Math.min(100, Math.max(0, Number(e.target.value)));
            controller.recordEdit(element, 'style', 'opacity', original.opacity, `${percent / 100}`);
          }}
        />
        <ResetButton controller={controller} element={element} property="opacity" />
      </label>
    </section>
  );
}
