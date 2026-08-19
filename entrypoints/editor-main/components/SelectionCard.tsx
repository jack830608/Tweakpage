import { useSyncExternalStore } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';
import type { EditsController } from '../controller';
import { Breadcrumb } from './Breadcrumb';
import { CopyIcon, EyeIcon, EyeOffIcon } from './icons';
import { t } from '../../../lib/i18n';

interface SelectionCardProps {
  element: Element;
  controller: EditsController;
  onSelect: (el: Element) => void;
  onPreviewSet: (els: Element[]) => void;
}

/** The family this selector names, from the document the element is actually in. */
function matches(el: Element, selector: string): Element[] {
  try {
    return Array.from(el.ownerDocument.querySelectorAll(selector));
  } catch {
    return [];
  }
}

// Ternary titles slip past the hard-coded-label guard, so these go through t() by hand.

export function SelectionCard({ element, controller, onSelect, onPreviewSet }: SelectionCardProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const similar = controller.similarTo(element);
  const hasStyleEdit = controller.getPage().records.some(
    (r) => r.type === 'style' && r.enabled && controller.recordFor(element, r.property)?.id === r.id,
  );
  const hiddenRecord = controller.recordFor(element, 'display');
  const hidden = hiddenRecord?.newValue === 'none';

  const onToggleHide = () => {
    if (hidden && hiddenRecord) {
      controller.deleteRecord(hiddenRecord.id);
      return;
    }
    controller.recordEdit(element, 'style', 'display', getComputedStyle(element).display, 'none');
  };

  return (
    <div className="twk-selection-card">
      <div className="twk-selection-head">
        <div className="twk-selection-label">{buildElementLabel(element)}</div>
        <div className="twk-selection-actions">
          {controller.canClone(element) && (
            <button
              type="button"
              aria-label={t('aria_duplicate_element')}
              data-testid="duplicate-element"
              title={t('tip_duplicate')}
              onClick={() => {
                const copy = controller.cloneElement(element);
                // The copy is why the button was pressed — select it, ready to edit.
                if (copy) onSelect(copy);
              }}
            >
              <CopyIcon /> {t('duplicate')}
            </button>
          )}
          <button
            type="button"
            aria-label={hidden ? t('aria_unhide_element') : t('aria_hide_element')}
            data-testid="hide-element"
            title={hidden ? t('tip_unhide') : t('tip_hide')}
            onClick={onToggleHide}
          >
            {hidden ? <><EyeIcon /> {t('unhide')}</> : <><EyeOffIcon /> {t('hide')}</>}
          </button>
        </div>
      </div>
      <Breadcrumb element={element} onSelect={onSelect} />
      {similar && (
        // Shown before it is done. Ticking this restyled elements the user had never
        // been shown and could not name — the count was the only evidence they existed.
        <label
          className="twk-similar"
          onPointerEnter={() => onPreviewSet(matches(element, similar.selector))}
          onPointerLeave={() => onPreviewSet([])}
        >
          <input
            type="checkbox"
            aria-label={t('aria_apply_similar')}
            data-testid="apply-to-similar"
            // It re-points style edits that exist, so with none it silently did nothing.
            disabled={!hasStyleEdit}
            title={hasStyleEdit ? undefined : t('tip_similar_needs_edit')}
            checked={controller.appliesToSimilar(element)}
            onFocus={() => onPreviewSet(matches(element, similar.selector))}
            onBlur={() => onPreviewSet([])}
            onChange={(e) => controller.setSimilarScope(element, e.target.checked)}
          />
          {t('apply_similar', [similar.count])}
        </label>
      )}
    </div>
  );
}
