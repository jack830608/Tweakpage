import { useEffect, useMemo, useState } from 'react';
import { pxToNumber, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ColorField } from '../ColorField';
import { ResetButton } from '../ResetButton';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

export function TypographySection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, color: s.color };
  }, [element]);
  const [lineHeightDraft, setLineHeightDraft] = useState(() =>
    original.lineHeight === 'normal' ? '' : original.lineHeight,
  );
  useEffect(() => {
    const v = getComputedStyle(element).lineHeight;
    setLineHeightDraft(v === 'normal' ? '' : v);
  }, [element]);
  return (
    <section className="pgve-section">
      <label>
        Font size
        <input
          type="number"
          aria-label="Font size"
          value={pxToNumber(cs.fontSize)}
          onChange={(e) => {
            if (e.target.value === '') return;
            controller.recordEdit(element, 'style', 'fontSize', original.fontSize, `${e.target.value}px`);
          }}
        />
        <ResetButton controller={controller} element={element} property="fontSize" />
      </label>
      <label>
        Font weight
        <select
          aria-label="Font weight"
          value={normalizeWeight(cs.fontWeight)}
          onChange={(e) => controller.recordEdit(element, 'style', 'fontWeight', original.fontWeight, e.target.value)}
        >
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <ResetButton controller={controller} element={element} property="fontWeight" />
      </label>
      <label>
        Line height
        <input
          type="text"
          aria-label="Line height"
          value={lineHeightDraft}
          placeholder="normal"
          onChange={(e) => {
            setLineHeightDraft(e.target.value);
            if (e.target.value === '') return;
            controller.recordEdit(element, 'style', 'lineHeight', original.lineHeight, e.target.value);
          }}
        />
        <ResetButton controller={controller} element={element} property="lineHeight" />
      </label>
      <ColorField
        label="Color"
        value={rgbToHex(cs.color)}
        onChange={(hex) => controller.recordEdit(element, 'style', 'color', original.color, hex)}
      />
      <ResetButton controller={controller} element={element} property="color" />
    </section>
  );
}

function normalizeWeight(weight: string): string {
  if (weight === 'normal') return '400';
  if (weight === 'bold') return '700';
  return WEIGHTS.includes(weight) ? weight : '400';
}
