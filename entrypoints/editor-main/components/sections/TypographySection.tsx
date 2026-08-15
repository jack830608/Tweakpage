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
    return {
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color,
      textAlign: s.textAlign,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
    };
  }, [element]);
  const [fontDraft, setFontDraft] = useState(() => firstFont(original.fontFamily));
  useEffect(() => {
    setFontDraft(firstFont(getComputedStyle(element).fontFamily));
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
        Font family
        <input
          type="text"
          aria-label="Font family"
          list="pgve-font-suggestions"
          value={fontDraft}
          onChange={(e) => {
            const value = e.target.value;
            setFontDraft(value);
            if (value.trim() === '' || /[;{}]/.test(value)) return;
            controller.recordEdit(element, 'style', 'fontFamily', original.fontFamily, value.trim());
          }}
        />
        <ResetButton controller={controller} element={element} property="fontFamily" />
      </label>
      <datalist id="pgve-font-suggestions">
        <option value="system-ui" />
        <option value="Arial" />
        <option value="Helvetica Neue" />
        <option value="Verdana" />
        <option value="Georgia" />
        <option value="Times New Roman" />
        <option value="Courier New" />
        <option value="Menlo" />
        <option value="serif" />
        <option value="sans-serif" />
        <option value="monospace" />
      </datalist>
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
            const value = e.target.value;
            setLineHeightDraft(value);
            if (value === '') return;
            if (!/^(normal|\d*\.?\d+(px|em|rem|%)?)$/.test(value.trim())) return;
            controller.recordEdit(element, 'style', 'lineHeight', original.lineHeight, value.trim());
          }}
        />
        <ResetButton controller={controller} element={element} property="lineHeight" />
      </label>
      <label>
        Text align
        <select
          aria-label="Text align"
          value={normalizeAlign(cs.textAlign)}
          onChange={(e) => controller.recordEdit(element, 'style', 'textAlign', original.textAlign, e.target.value)}
        >
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
        <ResetButton controller={controller} element={element} property="textAlign" />
      </label>
      <label>
        Letter spacing
        <input
          type="number"
          step={0.1}
          aria-label="Letter spacing"
          value={pxToNumber(cs.letterSpacing)}
          onChange={(e) => {
            if (e.target.value === '') return;
            controller.recordEdit(element, 'style', 'letterSpacing', original.letterSpacing, `${e.target.value}px`);
          }}
        />
        <ResetButton controller={controller} element={element} property="letterSpacing" />
      </label>
      <label>
        Text transform
        <select
          aria-label="Text transform"
          value={cs.textTransform || 'none'}
          onChange={(e) => controller.recordEdit(element, 'style', 'textTransform', original.textTransform, e.target.value)}
        >
          <option value="none">none</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
        <ResetButton controller={controller} element={element} property="textTransform" />
      </label>
      <ColorField
        label="Color"
        value={rgbToHex(cs.color)}
        onChange={(hex) => controller.recordEdit(element, 'style', 'color', original.color, hex)}
        trailing={<ResetButton controller={controller} element={element} property="color" />}
      />
    </section>
  );
}

function firstFont(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
}

function normalizeAlign(align: string): string {
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

function normalizeWeight(weight: string): string {
  if (weight === 'normal') return '400';
  if (weight === 'bold') return '700';
  return WEIGHTS.includes(weight) ? weight : '400';
}
