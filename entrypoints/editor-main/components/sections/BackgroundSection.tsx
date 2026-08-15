import { useEffect, useMemo, useState } from 'react';
import { isTransparent, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ColorField } from '../ColorField';
import { ResetButton } from '../ResetButton';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

function urlFromBackgroundImage(value: string): string {
  const match = value.match(/^url\("?([^")]+)"?\)$/);
  return match ? match[1] : '';
}

export function BackgroundSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    return { backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage || 'none' };
  }, [element]);
  const [imageUrl, setImageUrl] = useState(() => urlFromBackgroundImage(original.backgroundImage));
  useEffect(() => {
    setImageUrl(urlFromBackgroundImage(getComputedStyle(element).backgroundImage || 'none'));
  }, [element]);

  const onApplyImage = () => {
    const url = imageUrl.trim().replace(/["\\]/g, '');
    if (!/^(https?:\/\/|data:image\/)/.test(url)) return;
    controller.recordEdit(element, 'style', 'backgroundImage', original.backgroundImage, `url("${url}")`);
  };
  return (
    <section className="pgve-section">
      <ColorField
        label={t('label_bg_color')}
        ariaLabel="Background color"
        value={isTransparent(cs.backgroundColor) ? null : rgbToHex(cs.backgroundColor)}
        onChange={(hex) => controller.recordEdit(element, 'style', 'backgroundColor', original.backgroundColor, hex)}
        trailing={<ResetButton controller={controller} element={element} property="backgroundColor" />}
      />
      <label>
        {t('label_bg_image')}
        <input
          type="text"
          aria-label="Background image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <ResetButton controller={controller} element={element} property="backgroundImage" />
      </label>
      <button type="button" aria-label="Apply background image" onClick={onApplyImage}>
        {t('apply')}
      </button>
    </section>
  );
}
