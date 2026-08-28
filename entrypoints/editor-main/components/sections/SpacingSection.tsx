import { useSyncExternalStore } from 'react';
import { pxToDisplay } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];
type Kind = 'padding' | 'margin';

function propName(kind: Kind, side: Side): string {
  return `${kind}${side[0].toUpperCase()}${side.slice(1)}`;
}

const ALL_PROPERTIES = (['padding', 'margin'] as Kind[]).flatMap((kind) =>
  SIDES.map((side) => propName(kind, side)),
);

export function SpacingSection({ element, controller }: SectionProps) {
  const rect = element.getBoundingClientRect();
  useSyncExternalStore(controller.subscribe, controller.getPage);
  // Eight reset buttons would swamp the box model, so the section resets as a unit
  // and each edited side carries its own accent to show what changed.
  const edited = ALL_PROPERTIES.some((property) => controller.recordFor(element, property));
  return (
    <section className="twk-section">
      <div className="twk-box twk-box--margin">
        <span className="twk-box-label">margin</span>
        {SIDES.map((side) => (
          <BoxInput key={side} kind="margin" side={side} element={element} controller={controller} />
        ))}
        <div className="twk-box twk-box--padding">
          <span className="twk-box-label">padding</span>
          {SIDES.map((side) => (
            <BoxInput key={side} kind="padding" side={side} element={element} controller={controller} />
          ))}
          <div className="twk-box-center">
            {Math.round(rect.width)}×{Math.round(rect.height)}
          </div>
        </div>
      </div>
      {edited && (
        <button
          type="button"
          className="twk-spacing-reset"
          aria-label={t('aria_reset_spacing')} data-testid="reset-spacing"
          onClick={() => controller.resetProperties(element, ALL_PROPERTIES)}
        >
          ↺ {t('reset_spacing')}
        </button>
      )}
    </section>
  );
}

interface BoxInputProps {
  kind: Kind;
  side: Side;
  element: Element;
  controller: EditsController;
}

function BoxInput({ kind, side, element, controller }: BoxInputProps) {
  const property = propName(kind, side);
  const computed = getComputedStyle(element).getPropertyValue(`${kind}-${side}`);
  const field = useFieldDraft(controller, element, property, computed, pxToDisplay, sameNumber);
  const edited = controller.recordFor(element, property) !== undefined;
  return (
    <input
      type="number"
      aria-label={t(`aria_${kind}`, [t(`side_${side}`)])}
      data-testid={`${kind}-${side}`}
      // The box model does not use Field, so it carries the hook itself: without it the
      // style summary had nothing to scroll to and its padding chip did nothing at all.
      data-property={property}
      className={`twk-box-input--${side}${edited ? ' twk-box-input--edited' : ''}`}
      value={field.value}
      onChange={(e) => {
        const raw = e.target.value;
        field.setDraft(raw);
        if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
        controller.recordEdit(element, 'style', property, field.original, `${Number(raw)}px`);
      }}
    />
  );
}
