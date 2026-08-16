import { useSyncExternalStore } from 'react';
import { hasInlineMarkup, textNodeProperty, textRuns } from '../../../../lib/edits/text-nodes';
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
  useSyncExternalStore(controller.subscribe, controller.getPage);
  if (!hasDirectText(element)) return null;

  // One box per run of text, so a heading keeps the link or coloured span inside it.
  // Writing the whole element back is only safe when there is no markup to lose.
  if (hasInlineMarkup(element)) {
    return (
      <section className="pgve-section">
        {textRuns(element).map((run) => {
          const property = textNodeProperty(run.index);
          const record = controller.recordFor(element, property);
          const original = record?.oldValue ?? run.node.nodeValue ?? '';
          return (
            <Field
              key={property}
              name={run.label}
              property={property}
              controller={controller}
              element={element}
              stacked
            >
              <textarea
                aria-label={t('aria_text_run', [run.label])}
                data-testid={`text-run-${run.index}`}
                rows={2}
                value={record?.newValue ?? run.node.nodeValue ?? ''}
                onChange={(e) =>
                  controller.recordEdit(element, 'text', property, original, e.target.value)
                }
              />
            </Field>
          );
        })}
        <p className="pgve-hint">{t('runs_hint')}</p>
      </section>
    );
  }

  const record = controller.recordFor(element, 'textContent');
  const original = record?.oldValue ?? element.textContent ?? '';
  return (
    <section className="pgve-section">
      <Field name="text" property="textContent" controller={controller} element={element} stacked>
        <textarea
          aria-label={t('aria_text')}
          data-testid="text"
          rows={3}
          value={record?.newValue ?? element.textContent ?? ''}
          onChange={(e) =>
            controller.recordEdit(element, 'text', 'textContent', original, e.target.value)
          }
        />
      </Field>
    </section>
  );
}
