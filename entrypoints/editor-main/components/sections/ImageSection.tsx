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
    <section className="pgve-section">
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
      <div className="pgve-field pgve-field--actions">
        <span aria-hidden="true" />
        <div className="pgve-field-actions">
          <ImagePicker ariaLabel={t('aria_choose_image')} testId="image-file" onPicked={applySrc} />
        </div>
      </div>
    </section>
  );
}
