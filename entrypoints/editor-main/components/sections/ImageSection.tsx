import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { clearResponsiveSources } from '../../responsive-images';
import { Field } from '../Field';
import { ImagePicker } from '../ImagePicker';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const IMAGE_URL = /^(https?:\/\/|data:image\/|\/)/;

export function ImageSection({ element, controller }: SectionProps) {
  const src = useFieldDraft(controller, element, 'src', element.getAttribute('src') ?? '');
  const alt = useFieldDraft(controller, element, 'alt', element.getAttribute('alt') ?? '');
  if (element.tagName !== 'IMG') return null;

  const applySrc = (url: string) => {
    controller.recordEdit(element, 'attr', 'src', src.original, url);
    // srcset and <picture><source> outrank src; without clearing them the swap is invisible.
    clearResponsiveSources(element, controller);
  };

  /**
   * Committing on blur or Enter rather than on every keystroke: a half-typed URL is not
   * a value worth recording, and it would send the page after an image that isn't there.
   */
  const commit = () => {
    const url = src.value.trim();
    if (url === '' || url === element.getAttribute('src')) return;
    if (!IMAGE_URL.test(url)) {
      src.reject(t('err_image_url'));
      return;
    }
    applySrc(url);
  };

  return (
    <section className="twk-section">
      <Field name="src" property="src" controller={controller} element={element} error={src.error}>
        <input
          type="text"
          aria-label={t('aria_image_url')}
          data-testid="image-url"
          placeholder={t('image_url_placeholder')}
          value={src.value}
          onChange={(e) => src.setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            commit();
          }}
        />
      </Field>
      <div className="twk-field twk-field--actions">
        <span aria-hidden="true" />
        <div className="twk-field-actions">
          <ImagePicker ariaLabel={t('aria_choose_image')} testId="image-file" onPicked={applySrc} />
        </div>
      </div>
      <Field name="alt" property="alt" controller={controller} element={element}>
        <input
          type="text"
          aria-label={t('aria_alt')}
          data-testid="alt"
          placeholder={t('alt_placeholder')}
          value={alt.value}
          onChange={(e) => alt.setDraft(e.target.value)}
          onBlur={() => {
            if (alt.value !== element.getAttribute('alt')) {
              controller.recordEdit(element, 'attr', 'alt', alt.original, alt.value);
            }
          }}
        />
      </Field>
    </section>
  );
}
