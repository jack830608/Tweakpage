import { pxToDisplay } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { Field } from '../Field';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const FIELDS = [
  { ariaLabel: 'Width', property: 'width' },
  { ariaLabel: 'Height', property: 'height' },
] as const;

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
  const field = useFieldDraft(controller, element, property, computed, pxToDisplay, sameNumber);
  return (
    <Field name={property} property={property} controller={controller} element={element}>
      <input
        type="number"
        min={0}
        aria-label={ariaLabel}
        value={field.value}
        onChange={(e) => {
          const raw = e.target.value;
          field.setDraft(raw);
          if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
          controller.recordEdit(element, 'style', property, field.original, `${Number(raw)}px`);
        }}
      />
    </Field>
  );
}
