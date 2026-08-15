import { useMemo } from 'react';
import { isTransparent, pxToNumber, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ColorField } from '../ColorField';
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
      borderWidth: s.getPropertyValue('border-top-width'),
      borderStyle: s.getPropertyValue('border-top-style'),
      borderColor: s.getPropertyValue('border-top-color'),
    };
  }, [element]);

  const radius = pxToNumber(cs.getPropertyValue('border-top-left-radius'));
  const opacity = Math.round(Number.parseFloat(cs.opacity || '1') * 100);

  const setRadius = (raw: string) => {
    if (raw === '') return;
    const value = Math.max(0, Number(raw));
    controller.recordEdit(element, 'style', 'borderRadius', original.borderRadius, `${value}px`);
  };
  const setBorderWidth = (raw: string) => {
    if (raw === '') return;
    const value = Math.max(0, Number(raw));
    controller.recordEdit(element, 'style', 'borderWidth', original.borderWidth, `${value}px`);
    if (value > 0 && getComputedStyle(element).getPropertyValue('border-top-style') === 'none') {
      controller.recordEdit(element, 'style', 'borderStyle', original.borderStyle, 'solid');
    }
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
      <label>
        Border width
        <input
          type="number"
          min={0}
          aria-label="Border width"
          value={pxToNumber(cs.getPropertyValue('border-top-width'))}
          onChange={(e) => setBorderWidth(e.target.value)}
        />
        <ResetButton controller={controller} element={element} property="borderWidth" />
      </label>
      <ColorField
        label="Border color"
        value={isTransparent(cs.getPropertyValue('border-top-color')) ? null : rgbToHex(cs.getPropertyValue('border-top-color'))}
        onChange={(hex) => controller.recordEdit(element, 'style', 'borderColor', original.borderColor, hex)}
        trailing={<ResetButton controller={controller} element={element} property="borderColor" />}
      />
    </section>
  );
}
