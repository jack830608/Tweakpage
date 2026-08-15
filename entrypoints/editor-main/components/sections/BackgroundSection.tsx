import { useMemo } from 'react';
import { isTransparent, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ColorField } from '../ColorField';
import { ResetButton } from '../ResetButton';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function BackgroundSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => getComputedStyle(element).backgroundColor, [element]);
  return (
    <section className="pgve-section">
      <ColorField
        label="Background color"
        value={isTransparent(cs.backgroundColor) ? null : rgbToHex(cs.backgroundColor)}
        onChange={(hex) => controller.recordEdit(element, 'style', 'backgroundColor', original, hex)}
      />
      <ResetButton controller={controller} element={element} property="backgroundColor" />
    </section>
  );
}
