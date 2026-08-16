import type { EditsController } from '../../controller';
import { Field } from '../Field';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function hasDirectText(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
  );
}

export function TextSection({ element, controller }: SectionProps) {
  if (!hasDirectText(element)) return null;
  const record = controller.recordFor(element, 'textContent');
  const original = record?.oldValue ?? element.textContent ?? '';
  const value = record?.newValue ?? element.textContent ?? '';
  return (
    <section className="pgve-section">
      <Field name="text" property="textContent" controller={controller} element={element} stacked>
        <textarea
          aria-label={t('aria_text')} data-testid="text"
          rows={3}
          value={value}
          onChange={(e) =>
            controller.recordEdit(element, 'text', 'textContent', original, e.target.value)
          }
        />
      </Field>
      {element.firstElementChild !== null && <p className="pgve-hint">{t('mixed_warning')}</p>}
    </section>
  );
}
