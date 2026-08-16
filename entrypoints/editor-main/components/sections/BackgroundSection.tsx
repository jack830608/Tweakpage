import { isTransparent, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { ColorField } from '../ColorField';
import { Field } from '../Field';
import { ImagePicker } from '../ImagePicker';
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

  const setImage = (url: string) =>
    controller.recordEdit(element, 'style', 'backgroundImage', image.original, `url("${url}")`);

  const onApplyImage = () => {
    const url = image.value.trim().replace(/["\\]/g, '');
    if (!/^(https?:\/\/|data:image\/)/.test(url)) {
      image.reject(t('err_image_url'));
      return;
    }
    setImage(url);
  };

  return (
    <section className="pgve-section">
      <ColorField
        name="background-color"
        property="backgroundColor"
        controller={controller}
        element={element}
        ariaLabel={t('aria_bg_color')}
        value={color.value === '' ? null : color.value}
        onChange={(hex) =>
          controller.recordEdit(element, 'style', 'backgroundColor', color.original, hex)
        }
      />
      <Field
        name="background-image"
        property="backgroundImage"
        controller={controller}
        element={element}
        error={image.error}
      >
        <input
          type="text"
          aria-label={t('aria_bg_image_url')} data-testid="background-image-url"
          value={image.value}
          onChange={(e) => image.setDraft(e.target.value)}
        />
      </Field>
      <div className="pgve-field-actions">
        <button type="button" aria-label={t('aria_apply_bg_image')} data-testid="apply-background-image" onClick={onApplyImage}>
          {t('apply')}
        </button>
        <ImagePicker ariaLabel="Choose background image file" onPicked={setImage} />
      </div>
    </section>
  );
}
