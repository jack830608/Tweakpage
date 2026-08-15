import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { ResetButton } from '../ResetButton';
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
      <label>
        <span className="pgve-prop">src</span>
        <input
          type="text"
          aria-label="Image URL"
          value={src.value}
          onChange={(e) => src.setDraft(e.target.value)}
        />
        <ResetButton controller={controller} element={element} property="src" />
      </label>
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
