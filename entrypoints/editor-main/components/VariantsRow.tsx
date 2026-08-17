import { useState, useSyncExternalStore } from 'react';
import type { EditsController } from '../controller';
import { t } from '../../../lib/i18n';

interface VariantsRowProps {
  controller: EditsController;
}

/**
 * Saved proposals for the same page.
 *
 * Comparing two directions used to mean exporting one, reverting, rebuilding the other,
 * and holding both in your head. Saving is one button; switching is a select, and it is
 * undoable like any other change.
 */
export function VariantsRow({ controller }: VariantsRowProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const variants = controller.getVariants();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const hasEdits = controller.getPage().records.length > 0;

  if (!hasEdits && variants.length === 0) return null;

  const save = () => {
    controller.saveVariant(name || t('variant_default_name', [variants.length + 1]));
    setName('');
    setNaming(false);
  };

  return (
    <div className="twk-variants">
      <span className="twk-share-label">{t('variants')}</span>
      {variants.length > 0 && (
        <div className="twk-variant-list">
          {variants.map((variant) => (
            <span key={variant.id} className="twk-variant">
              <button
                type="button"
                aria-label={t('aria_load_variant', [variant.name])}
                data-testid={`load-variant-${variant.id}`}
                onClick={() => controller.loadVariant(variant.id)}
              >
                {variant.name}
              </button>
              <button
                type="button"
                className="twk-variant-remove"
                aria-label={t('aria_delete_variant', [variant.name])}
                data-testid={`delete-variant-${variant.id}`}
                onClick={() => controller.deleteVariant(variant.id)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {naming ? (
        <span className="twk-variant-naming">
          <input
            type="text"
            aria-label={t('aria_variant_name')}
            data-testid="variant-name"
            placeholder={t('variant_default_name', [variants.length + 1])}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setNaming(false);
            }}
          />
          <button type="button" aria-label={t('aria_save_variant')} data-testid="save-variant" onClick={save}>
            {t('variant_save')}
          </button>
        </span>
      ) : (
        hasEdits && (
          <button
            type="button"
            className="twk-variant-add"
            aria-label={t('aria_new_variant')}
            data-testid="new-variant"
            onClick={() => setNaming(true)}
          >
            {t('variant_new')}
          </button>
        )
      )}
    </div>
  );
}
