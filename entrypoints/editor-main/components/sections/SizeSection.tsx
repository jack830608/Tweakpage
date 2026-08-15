import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { Field } from '../Field';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const FIELDS = [
  { ariaLabel: 'Width', property: 'width' },
  { ariaLabel: 'Height', property: 'height' },
] as const;

const SIZE_VALUE =
  /^(auto|none|min-content|max-content|fit-content|-?\d*\.?\d+(px|%|em|rem|vw|vh|ch|pt)?)$/;

/** A bare number means px; anything else is a CSS value the user typed on purpose. */
function toCssSize(raw: string): string | null {
  const value = raw.trim();
  if (!SIZE_VALUE.test(value)) return null;
  return /^-?\d*\.?\d+$/.test(value) ? `${Number(value)}px` : value;
}

/** px comes back as a bare number; keywords and percentages stay as they were typed. */
function showSize(raw: string): string {
  return raw.endsWith('px') ? String(Number.parseFloat(raw)) : raw;
}

export function SizeSection({ element, controller }: SectionProps) {
  return (
    <section className="pgve-section">
      {FIELDS.map(({ ariaLabel, property }) => (
        <SizeField
          key={property}
          ariaLabel={ariaLabel}
          property={property}
          element={element}
          controller={controller}
        />
      ))}
      <datalist id="pgve-size-suggestions">
        <option value="auto" />
        <option value="100%" />
        <option value="50%" />
        <option value="fit-content" />
        <option value="min-content" />
        <option value="max-content" />
      </datalist>
    </section>
  );
}

interface SizeFieldProps {
  ariaLabel: string;
  property: string;
  element: Element;
  controller: EditsController;
}

function SizeField({ ariaLabel, property, element, controller }: SizeFieldProps) {
  const computed = getComputedStyle(element).getPropertyValue(property);
  const field = useFieldDraft(controller, element, property, computed, showSize);
  return (
    <Field name={property} property={property} controller={controller} element={element}>
      <input
        type="text"
        inputMode="text"
        aria-label={ariaLabel}
        list="pgve-size-suggestions"
        value={field.value}
        onChange={(e) => {
          const raw = e.target.value;
          field.setDraft(raw);
          const next = toCssSize(raw);
          if (next === null) return;
          controller.recordEdit(element, 'style', property, field.original, next);
        }}
      />
    </Field>
  );
}
