import { isTransparent, pxToDisplay, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { ColorField } from '../ColorField';
import { Field } from '../Field';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function AppearanceSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const radius = useFieldDraft(
    controller,
    element,
    'borderRadius',
    cs.getPropertyValue('border-top-left-radius'),
    pxToDisplay,
    sameNumber,
  );
  const opacity = useFieldDraft(controller, element, 'opacity', cs.opacity, toPercent, sameNumber);
  const borderWidth = useFieldDraft(
    controller,
    element,
    'borderWidth',
    cs.getPropertyValue('border-top-width'),
    pxToDisplay,
    sameNumber,
  );
  const borderColor = useFieldDraft(
    controller,
    element,
    'borderColor',
    cs.getPropertyValue('border-top-color'),
    (v) => (isTransparent(v) ? '' : rgbToHex(v)),
  );

  const setRadius = (raw: string) => {
    radius.setDraft(raw);
    if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
    const value = Math.max(0, Number(raw));
    controller.recordEdit(element, 'style', 'borderRadius', radius.original, `${value}px`);
  };
  const setBorderWidth = (raw: string) => {
    borderWidth.setDraft(raw);
    if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
    const value = Math.max(0, Number(raw));
    controller.recordEdit(element, 'style', 'borderWidth', borderWidth.original, `${value}px`);
    // A width with no style paints nothing. Hosts report an unset style as either
    // "none" or an empty string.
    const style = getComputedStyle(element).getPropertyValue('border-top-style');
    if (value > 0 && (style === 'none' || style === '')) {
      controller.recordEdit(
        element,
        'style',
        'borderStyle',
        cs.getPropertyValue('border-top-style'),
        'solid',
      );
    }
  };
  const setOpacity = (raw: string) => {
    opacity.setDraft(raw);
    if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
    const percent = Math.min(100, Math.max(0, Number(raw)));
    controller.recordEdit(element, 'style', 'opacity', opacity.original, `${percent / 100}`);
  };

  return (
    <section className="pgve-section">
      <Field name="border-radius" property="borderRadius" controller={controller} element={element}>
        <span className="pgve-slider-pair">
          <input
            type="range"
            min={0}
            max={64}
            aria-label="Corner radius"
            value={clamp(radius.value, 0, 64)}
            onChange={(e) => setRadius(e.target.value)}
          />
          <input
            type="number"
            min={0}
            aria-label="Corner radius value"
            value={radius.value}
            onChange={(e) => setRadius(e.target.value)}
          />
        </span>
      </Field>
      <Field name="opacity" property="opacity" controller={controller} element={element}>
        <span className="pgve-slider-pair">
          <input
            type="range"
            min={0}
            max={100}
            aria-label="Opacity"
            value={clamp(opacity.value, 0, 100)}
            onChange={(e) => setOpacity(e.target.value)}
          />
          <input
            type="number"
            min={0}
            max={100}
            aria-label="Opacity value"
            value={opacity.value}
            onChange={(e) => setOpacity(e.target.value)}
          />
        </span>
      </Field>
      <Field
        name="border-width"
        property="borderWidth"
        controller={controller}
        element={element}
        companions={['borderStyle']}
      >
        <input
          type="number"
          min={0}
          aria-label="Border width"
          value={borderWidth.value}
          onChange={(e) => setBorderWidth(e.target.value)}
        />
      </Field>
      <ColorField
        name="border-color"
        property="borderColor"
        controller={controller}
        element={element}
        ariaLabel="Border color"
        value={borderColor.value === '' ? null : borderColor.value}
        onChange={(hex) =>
          controller.recordEdit(element, 'style', 'borderColor', borderColor.original, hex)
        }
      />
    </section>
  );
}

function toPercent(raw: string): string {
  const n = Number.parseFloat(raw);
  return String(Math.round((Number.isFinite(n) ? n : 1) * 100));
}

function clamp(value: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
