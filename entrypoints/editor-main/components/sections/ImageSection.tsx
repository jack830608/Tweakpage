import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { Field } from '../Field';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function ImageSection({ element, controller }: SectionProps) {
  const src = useFieldDraft(controller, element, 'src', element.getAttribute('src') ?? '');
  if (element.tagName !== 'IMG') return null;
  return (
    <section className="pgve-section">
      <Field name="src" property="src" controller={controller} element={element}>
        <input
          type="text"
          aria-label="Image URL"
          value={src.value}
          onChange={(e) => src.setDraft(e.target.value)}
        />
      </Field>
      <button
        type="button"
        aria-label="Apply image"
        onClick={() => controller.recordEdit(element, 'attr', 'src', src.original, src.value)}
      >
        {t('apply')}
      </button>
    </section>
  );
}
