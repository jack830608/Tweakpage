import { useEffect, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { parseDeclarations } from '../../../../lib/edits/custom-css';
import { PANEL_STYLE_PROPERTIES } from '../../../../lib/edits/import';
import type { EditsController } from '../../controller';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

/**
 * The escape hatch: CSS the panel has no field for.
 *
 * One textarea of ordinary declarations. On commit each becomes its own style record —
 * so every line shows up in Review, toggles, resets, exports and shares exactly like a
 * field edit — and deleting a line deletes its record. The panel's own properties stay
 * in their fields; this box owns only what no field owns.
 */
export function AdvancedSection({ element, controller }: SectionProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const custom = controller
    .getPage()
    .records.filter(
      (r) =>
        r.type === 'style' &&
        !PANEL_STYLE_PROPERTIES.has(r.property) &&
        controller.recordFor(element, r.property)?.id === r.id,
    );
  const recorded = custom.map((r) => `${r.property}: ${r.newValue};`).join('\n');

  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Another path changed the records (undo, Review): the box follows.
  useEffect(() => setDraft(null), [recorded, element]);

  const commit = () => {
    const text = draft ?? recorded;
    const parsed = parseDeclarations(text);
    if (!parsed.ok) {
      setError(t('custom_css_error', [parsed.error]));
      return;
    }
    setError(null);
    const wanted = new Map(parsed.declarations.map((d) => [d.property, d.value]));
    for (const record of custom) {
      if (!wanted.has(record.property)) controller.deleteRecord(record.id);
    }
    for (const [property, value] of wanted) {
      const view = element.ownerDocument.defaultView;
      const before = view?.getComputedStyle(element).getPropertyValue(property) ?? '';
      controller.recordEdit(element, 'style', property, before, value);
    }
    setDraft(null);
  };

  return (
    <section className="twk-section">
      <div className="twk-field twk-field--stacked">
        <span className="twk-prop">custom css</span>
        <textarea
          aria-label={t('aria_custom_css')}
          data-testid="custom-css"
          rows={3}
          spellCheck={false}
          placeholder={'transform: rotate(3deg);\nfilter: blur(2px);'}
          value={draft ?? recorded}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
      </div>
      {error && <p className="twk-field-error" role="alert">{error}</p>}
      <p className="twk-hint">{t('custom_css_hint')}</p>
    </section>
  );
}
