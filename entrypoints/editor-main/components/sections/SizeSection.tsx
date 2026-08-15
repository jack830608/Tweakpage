import { useMemo } from 'react';
import { pxToNumber } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ResetButton } from '../ResetButton';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const FIELDS = [
  { label: 'Width', property: 'width' },
  { label: 'Height', property: 'height' },
] as const;

export function SizeSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    return { width: s.width, height: s.height };
  }, [element]);
  return (
    <section className="pgve-section">
      {FIELDS.map(({ label, property }) => (
        <label key={property}>
          {label}
          <input
            type="number"
            aria-label={label}
            value={pxToNumber(cs.getPropertyValue(property))}
            onChange={(e) => {
              if (e.target.value === '') return;
              controller.recordEdit(element, 'style', property, original[property], `${e.target.value}px`);
            }}
          />
          <ResetButton controller={controller} element={element} property={property} />
        </label>
      ))}
    </section>
  );
}
