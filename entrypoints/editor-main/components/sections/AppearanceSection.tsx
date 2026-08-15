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

  const radius = pxToNumber(cs.getPropertyValue('border-top-left-radius'));
  const opacity = Math.round(Number.parseFloat(cs.opacity || '1') * 100);

  const setRadius = (raw: string) => {
    if (raw === '') return;
    const value = Math.max(0, Number(raw));
    controller.recordEdit(element, 'style', 'borderRadius', original.borderRadius, `${value}px`);
  };
  const setOpacity = (raw: string) => {
    if (raw === '') return;
    const percent = Math.min(100, Math.max(0, Number(raw)));
    controller.recordEdit(element, 'style', 'opacity', original.opacity, `${percent / 100}`);
  };

  return (
    <section className="pgve-section">
      <label>
        Corner radius
        <span className="pgve-slider-pair">
          <input
            type="range"
            min={0}
            max={64}
            aria-label="Corner radius"
            value={Math.min(64, radius)}
            onChange={(e) => setRadius(e.target.value)}
          />
          <input
            type="number"
            min={0}
            aria-label="Corner radius value"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        </span>
        <ResetButton controller={controller} element={element} property="borderRadius" />
      </label>
      <label>
        Opacity
        <span className="pgve-slider-pair">
          <input
            type="range"
            min={0}
            max={100}
            aria-label="Opacity"
            value={opacity}
            onChange={(e) => setOpacity(e.target.value)}
          />
          <input
            type="number"
            min={0}
            max={100}
            aria-label="Opacity value"
            value={opacity}
            onChange={(e) => setOpacity(e.target.value)}
          />
        </span>
        <ResetButton controller={controller} element={element} property="opacity" />
      </label>
    </section>
  );
}
