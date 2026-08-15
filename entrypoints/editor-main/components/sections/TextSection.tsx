import type { EditsController } from '../../controller';
import { ResetButton } from '../ResetButton';

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
      <h3>
        Text <ResetButton controller={controller} element={element} property="textContent" />
      </h3>
      <textarea
        aria-label="Text"
        rows={3}
        value={value}
        onChange={(e) => controller.recordEdit(element, 'text', 'textContent', original, e.target.value)}
      />
      {element.firstElementChild !== null && (
        <p className="pgve-hint">
          This element contains formatted parts — editing text here replaces them with
          plain text. Use the breadcrumb to edit an inner element instead.
        </p>
      )}
    </section>
  );
}
