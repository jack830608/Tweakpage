import { isTransparent, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
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
  const color = useFieldDraft(controller, element, 'backgroundColor', cs.backgroundColor, (v) =>
    isTransparent(v) ? '' : rgbToHex(v),
  );
  const image = useFieldDraft(
    controller,
    element,
    'backgroundImage',
    cs.backgroundImage || 'none',
    urlFromBackgroundImage,
  );

  const onApplyImage = () => {
    const url = image.value.trim().replace(/["\\]/g, '');
    if (!/^(https?:\/\/|data:image\/)/.test(url)) return;
    controller.recordEdit(element, 'style', 'backgroundImage', image.original, `url("${url}")`);
  };

  return (
    <section className="pgve-section">
      <ColorField
        label={<span className="pgve-prop">background-color</span>}
        ariaLabel="Background color"
        value={color.value === '' ? null : color.value}
        onChange={(hex) =>
          controller.recordEdit(element, 'style', 'backgroundColor', color.original, hex)
        }
        trailing={<ResetButton controller={controller} element={element} property="backgroundColor" />}
      />
      <label>
        <span className="pgve-prop">background-image</span>
        <input
          type="text"
          aria-label="Background image URL"
          value={image.value}
          onChange={(e) => image.setDraft(e.target.value)}
        />
        <ResetButton controller={controller} element={element} property="backgroundImage" />
      </label>
      <button type="button" aria-label="Apply background image" onClick={onApplyImage}>
        {t('apply')}
      </button>
    </section>
  );
}
