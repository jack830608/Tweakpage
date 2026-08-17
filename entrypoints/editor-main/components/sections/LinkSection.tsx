import type { EditsController } from '../../controller';
import { useFieldDraft } from '../../hooks/useFieldDraft';
import { Field } from '../Field';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

/** Anything a browser will follow, plus the in-page forms. */
const HREF = /^(https?:\/\/|mailto:|tel:|\/|#|\?)/;

export function isLink(el: Element): boolean {
  return el.tagName === 'A';
}

/**
 * Where a link points.
 *
 * Retargeting a call to action is one of the most common things anyone wants to try on a
 * page, and it was the one part of a link the editor could not touch.
 */
export function LinkSection({ element, controller }: SectionProps) {
  const href = useFieldDraft(controller, element, 'href', element.getAttribute('href') ?? '');

  const commit = () => {
    const url = href.value.trim();
    if (url === '' || url === element.getAttribute('href')) return;
    if (!HREF.test(url)) {
      href.reject(t('err_href'));
      return;
    }
    controller.recordEdit(element, 'attr', 'href', href.original, url);
  };

  return (
    <section className="twk-section">
      <Field name="href" property="href" controller={controller} element={element} error={href.error}>
        <input
          type="text"
          aria-label={t('aria_href')}
          data-testid="href"
          placeholder="https://…"
          value={href.value}
          onChange={(e) => href.setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            commit();
          }}
        />
      </Field>
    </section>
  );
}
