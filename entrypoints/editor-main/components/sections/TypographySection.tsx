import { pxToDisplay, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { ColorField } from '../ColorField';
import { Field } from '../Field';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

export function TypographySection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const fontFamily = useFieldDraft(controller, element, 'fontFamily', cs.fontFamily, firstFont);
  const fontSize = useFieldDraft(controller, element, 'fontSize', cs.fontSize, pxToDisplay, sameNumber);
  const fontWeight = useFieldDraft(controller, element, 'fontWeight', cs.fontWeight, normalizeWeight);
  const lineHeight = useFieldDraft(controller, element, 'lineHeight', cs.lineHeight, (v) =>
    v === 'normal' ? '' : v,
  );
  const textAlign = useFieldDraft(controller, element, 'textAlign', cs.textAlign, normalizeAlign);
  const letterSpacing = useFieldDraft(
    controller,
    element,
    'letterSpacing',
    cs.letterSpacing,
    pxToDisplay,
    sameNumber,
  );
  const textTransform = useFieldDraft(
    controller,
    element,
    'textTransform',
    cs.textTransform,
    (v) => v || 'none',
  );
  const color = useFieldDraft(controller, element, 'color', cs.color, rgbToHex);

  return (
    <section className="pgve-section">
      <Field name="font-family" property="fontFamily" controller={controller} element={element}>
        <input
          type="text"
          aria-label="Font family"
          list="pgve-font-suggestions"
          value={fontFamily.value}
          onChange={(e) => {
            const value = e.target.value;
            fontFamily.setDraft(value);
            if (value.trim() === '' || /[;{}]/.test(value)) return;
            controller.recordEdit(element, 'style', 'fontFamily', fontFamily.original, value.trim());
          }}
        />
      </Field>
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
      <Field name="font-size" property="fontSize" controller={controller} element={element}>
        <input
          type="number"
          min={1}
          aria-label="Font size"
          value={fontSize.value}
          onChange={(e) => {
            const raw = e.target.value;
            fontSize.setDraft(raw);
            if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
            controller.recordEdit(element, 'style', 'fontSize', fontSize.original, `${Number(raw)}px`);
          }}
        />
      </Field>
      <Field name="font-weight" property="fontWeight" controller={controller} element={element}>
        <select
          aria-label="Font weight"
          value={fontWeight.value}
          onChange={(e) =>
            controller.recordEdit(element, 'style', 'fontWeight', fontWeight.original, e.target.value)
          }
        >
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </Field>
      <Field name="line-height" property="lineHeight" controller={controller} element={element}>
        <input
          type="text"
          aria-label="Line height"
          value={lineHeight.value}
          placeholder="normal"
          onChange={(e) => {
            const value = e.target.value;
            lineHeight.setDraft(value);
            if (value === '') return;
            if (!/^(normal|\d*\.?\d+(px|em|rem|%)?)$/.test(value.trim())) return;
            controller.recordEdit(element, 'style', 'lineHeight', lineHeight.original, value.trim());
          }}
        />
      </Field>
      <Field name="text-align" property="textAlign" controller={controller} element={element}>
        <select
          aria-label="Text align"
          value={textAlign.value}
          onChange={(e) =>
            controller.recordEdit(element, 'style', 'textAlign', textAlign.original, e.target.value)
          }
        >
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </Field>
      <Field name="letter-spacing" property="letterSpacing" controller={controller} element={element}>
        <input
          type="number"
          step={0.1}
          aria-label="Letter spacing"
          value={letterSpacing.value}
          onChange={(e) => {
            const raw = e.target.value;
            letterSpacing.setDraft(raw);
            if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
            controller.recordEdit(
              element,
              'style',
              'letterSpacing',
              letterSpacing.original,
              `${Number(raw)}px`,
            );
          }}
        />
      </Field>
      <Field name="text-transform" property="textTransform" controller={controller} element={element}>
        <select
          aria-label="Text transform"
          value={textTransform.value}
          onChange={(e) =>
            controller.recordEdit(
              element,
              'style',
              'textTransform',
              textTransform.original,
              e.target.value,
            )
          }
        >
          <option value="none">none</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
      </Field>
      <ColorField
        name="color"
        property="color"
        controller={controller}
        element={element}
        ariaLabel="Color"
        value={color.value}
        onChange={(hex) => controller.recordEdit(element, 'style', 'color', color.original, hex)}
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
