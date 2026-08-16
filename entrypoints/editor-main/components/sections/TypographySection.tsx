import { pxToDisplay, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { ColorField } from '../ColorField';
import { Field } from '../Field';
import { scrubbedValue } from '../../scrub';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const ALIGNMENTS = ['left', 'center', 'right', 'justify', 'start', 'end'];

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
      <Field name="font-family" property="fontFamily" controller={controller} element={element} error={fontFamily.error}>
        <input
          type="text"
          aria-label={t('aria_font_family')} data-testid="font-family"
          list="pgve-font-suggestions"
          value={fontFamily.value}
          onChange={(e) => {
            const value = e.target.value;
            fontFamily.setDraft(value);
            if (value.trim() === '') return;
            if (/[;{}]/.test(value)) {
              fontFamily.reject(t('err_font_family'));
              return;
            }
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
      <Field
        name="font-size"
        property="fontSize"
        controller={controller}
        element={element}
        unit="px"
        value={fontSize.value}
        error={fontSize.error}
        onScrub={(steps) => {
          const next = scrubbedValue(controller, element, 'fontSize', fontSize.original, steps, {
            min: 1,
          });
          controller.recordEdit(element, 'style', 'fontSize', fontSize.original, `${next}px`);
        }}
      >
        <input
          type="number"
          min={1}
          aria-label={t('aria_font_size')} data-testid="font-size"
          value={fontSize.value}
          onChange={(e) => {
            const raw = e.target.value;
            fontSize.setDraft(raw);
            if (raw.trim() === '') return;
            if (!Number.isFinite(Number(raw))) {
              fontSize.reject(t('err_number'));
              return;
            }
            controller.recordEdit(element, 'style', 'fontSize', fontSize.original, `${Number(raw)}px`);
          }}
        />
      </Field>
      <Field name="font-weight" property="fontWeight" controller={controller} element={element}>
        <select
          aria-label={t('aria_font_weight')} data-testid="font-weight"
          value={fontWeight.value}
          onChange={(e) =>
            controller.recordEdit(element, 'style', 'fontWeight', fontWeight.original, e.target.value)
          }
        >
          {!WEIGHTS.includes(fontWeight.value) && (
            <option value={fontWeight.value}>{fontWeight.value}</option>
          )}
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </Field>
      <Field
        name="line-height"
        property="lineHeight"
        controller={controller}
        element={element}
        error={lineHeight.error}
        value={lineHeight.value}
        onScrub={(steps) => {
          const next = scrubbedValue(controller, element, 'lineHeight', lineHeight.original, steps, {
            increment: 0.1,
            min: 0,
          });
          controller.recordEdit(element, 'style', 'lineHeight', lineHeight.original, String(next));
        }}
      >
        <input
          type="text"
          aria-label={t('aria_line_height')} data-testid="line-height"
          value={lineHeight.value}
          placeholder="normal"
          onChange={(e) => {
            const value = e.target.value;
            lineHeight.setDraft(value);
            if (value === '') return;
            if (!/^(normal|\d*\.?\d+(px|em|rem|%)?)$/.test(value.trim())) {
              lineHeight.reject(t('err_line_height'));
              return;
            }
            controller.recordEdit(element, 'style', 'lineHeight', lineHeight.original, value.trim());
          }}
        />
      </Field>
      <Field name="text-align" property="textAlign" controller={controller} element={element}>
        <select
          aria-label={t('aria_text_align')} data-testid="text-align"
          value={textAlign.value}
          onChange={(e) =>
            controller.recordEdit(element, 'style', 'textAlign', textAlign.original, e.target.value)
          }
        >
          {!ALIGNMENTS.includes(textAlign.value) && (
            <option value={textAlign.value}>{textAlign.value}</option>
          )}
          {ALIGNMENTS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </Field>
      <Field
        name="letter-spacing"
        property="letterSpacing"
        controller={controller}
        element={element}
        unit="px"
        value={letterSpacing.value}
        error={letterSpacing.error}
        onScrub={(steps) => {
          const next = scrubbedValue(
            controller,
            element,
            'letterSpacing',
            letterSpacing.original,
            steps,
            { increment: 0.1 },
          );
          controller.recordEdit(element, 'style', 'letterSpacing', letterSpacing.original, `${next}px`);
        }}
      >
        <input
          type="number"
          step={0.1}
          aria-label={t('aria_letter_spacing')} data-testid="letter-spacing"
          value={letterSpacing.value}
          onChange={(e) => {
            const raw = e.target.value;
            letterSpacing.setDraft(raw);
            if (raw.trim() === '') return;
            if (!Number.isFinite(Number(raw))) {
              letterSpacing.reject(t('err_number'));
              return;
            }
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
          aria-label={t('aria_text_transform')} data-testid="text-transform"
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
        ariaLabel={t('aria_color')}
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

/** Keeps whatever the element really uses — showing `justify` as `left` was a lie. */
function normalizeAlign(align: string): string {
  return align.trim() || 'left';
}

function normalizeWeight(weight: string): string {
  if (weight === 'normal') return '400';
  if (weight === 'bold') return '700';
  return weight.trim() || '400';
}
