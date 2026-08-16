import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { Field } from '../Field';
import { clearResponsiveSources } from '../../responsive-images';
import { ImagePicker } from '../ImagePicker';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function ImageSection({ element, controller }: SectionProps) {
  const src = useFieldDraft(controller, element, 'src', element.getAttribute('src') ?? '');
  if (element.tagName !== 'IMG') return null;

  const applySrc = (url: string) => {
    if (url.trim() === '') return;
    controller.recordEdit(element, 'attr', 'src', src.original, url);
    clearResponsiveSources(element, controller);
  };
  return (
    <section className="pgve-section">
      <Field name="src" property="src" controller={controller} element={element}>
        <input
          type="text"
          aria-label={t('aria_image_url')} data-testid="image-url"
          value={src.value}
          onChange={(e) => src.setDraft(e.target.value)}
        />
      </Field>
      <div className="pgve-field pgve-field--actions">
        <span aria-hidden="true" />
        <div className="pgve-field-actions">
        <button
          type="button"
          aria-label={t('aria_apply_image')} data-testid="apply-image"
          onClick={() => applySrc(src.value)}
        >
          {t('apply')}
        </button>
        <ImagePicker
          ariaLabel="Choose image file"
          onPicked={applySrc}
        />
        </div>
      </div>
    </section>
  );
}
