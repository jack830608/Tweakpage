import { pxToDisplay, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { ColorField } from '../ColorField';
import { ResetButton } from '../ResetButton';

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
      <label>
        <span className="pgve-prop">font-family</span>
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
        <span className="pgve-prop">font-size</span>
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
        <ResetButton controller={controller} element={element} property="fontSize" />
      </label>
      <label>
        <span className="pgve-prop">font-weight</span>
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
        <ResetButton controller={controller} element={element} property="fontWeight" />
      </label>
      <label>
        <span className="pgve-prop">line-height</span>
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
        <ResetButton controller={controller} element={element} property="lineHeight" />
      </label>
      <label>
        <span className="pgve-prop">text-align</span>
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
        <ResetButton controller={controller} element={element} property="textAlign" />
      </label>
      <label>
        <span className="pgve-prop">letter-spacing</span>
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
        <ResetButton controller={controller} element={element} property="letterSpacing" />
      </label>
      <label>
        <span className="pgve-prop">text-transform</span>
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
        <ResetButton controller={controller} element={element} property="textTransform" />
      </label>
      <ColorField
        label={<span className="pgve-prop">color</span>}
        ariaLabel="Color"
        value={color.value}
        onChange={(hex) => controller.recordEdit(element, 'style', 'color', color.original, hex)}
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
