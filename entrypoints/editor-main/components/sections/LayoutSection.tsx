import { pxToDisplay } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { sameNumber, useFieldDraft } from '../../hooks/useFieldDraft';
import { Field } from '../Field';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const DISPLAYS = ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none'];
const DIRECTIONS = ['row', 'row-reverse', 'column', 'column-reverse'];
const JUSTIFY = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const ALIGN = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'];
const POSITIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky'];

/**
 * The properties that decide where things sit.
 *
 * Longer copy is the most common thing to break a layout, and until now the editor could
 * cause that and offer nothing to fix it.
 */
export function LayoutSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const display = useFieldDraft(controller, element, 'display', cs.display);
  const isFlex = display.value.includes('flex');

  return (
    <section className="pgve-section">
      <Choice name="display" property="display" options={DISPLAYS} current={display.value}
        original={display.original} element={element} controller={controller} />
      {isFlex && (
        <>
          <Choice name="flex-direction" property="flexDirection" options={DIRECTIONS}
            current={cs.flexDirection} original={cs.flexDirection} element={element} controller={controller} />
          <Choice name="justify-content" property="justifyContent" options={JUSTIFY}
            current={cs.justifyContent} original={cs.justifyContent} element={element} controller={controller} />
          <Choice name="align-items" property="alignItems" options={ALIGN}
            current={cs.alignItems} original={cs.alignItems} element={element} controller={controller} />
          <Pixels name="gap" property="gap" computed={cs.gap} element={element} controller={controller} />
        </>
      )}
      <Choice name="position" property="position" options={POSITIONS} current={cs.position}
        original={cs.position} element={element} controller={controller} />
      <Field name="box-shadow" property="boxShadow" controller={controller} element={element}>
        <BoxShadowInput element={element} controller={controller} />
      </Field>
      <p className="pgve-hint">{t('layout_hint')}</p>
    </section>
  );
}

interface ChoiceProps {
  name: string;
  property: string;
  options: string[];
  current: string;
  original: string;
  element: Element;
  controller: EditsController;
}

function Choice({ name, property, options, current, original, element, controller }: ChoiceProps) {
  const field = useFieldDraft(controller, element, property, current);
  const value = field.value || original;
  return (
    <Field name={name} property={property} controller={controller} element={element}>
      <select
        aria-label={name}
        data-testid={name}
        value={value}
        onChange={(e) => controller.recordEdit(element, 'style', property, field.original, e.target.value)}
      >
        {!options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

interface PixelsProps {
  name: string;
  property: string;
  computed: string;
  element: Element;
  controller: EditsController;
}

function Pixels({ name, property, computed, element, controller }: PixelsProps) {
  const field = useFieldDraft(controller, element, property, computed, pxToDisplay, sameNumber);
  return (
    <Field name={name} property={property} controller={controller} element={element} error={field.error}>
      <input
        type="number"
        min={0}
        aria-label={name}
        data-testid={name}
        value={field.value}
        onChange={(e) => {
          const raw = e.target.value;
          field.setDraft(raw);
          if (raw.trim() === '') return;
          if (!Number.isFinite(Number(raw))) {
            field.reject(t('err_number'));
            return;
          }
          controller.recordEdit(element, 'style', property, field.original, `${Number(raw)}px`);
        }}
      />
    </Field>
  );
}

function BoxShadowInput({ element, controller }: { element: Element; controller: EditsController }) {
  const cs = getComputedStyle(element);
  const field = useFieldDraft(controller, element, 'boxShadow', cs.boxShadow || 'none');
  return (
    <input
      type="text"
      aria-label="box-shadow"
      data-testid="box-shadow"
      placeholder="0 8px 24px rgba(0,0,0,.2)"
      value={field.value === 'none' ? '' : field.value}
      onChange={(e) => {
        const raw = e.target.value;
        field.setDraft(raw);
        const value = raw.trim() === '' ? 'none' : raw.trim();
        if (/[;{}]/.test(value)) {
          field.reject(t('err_css_value'));
          return;
        }
        controller.recordEdit(element, 'style', 'boxShadow', field.original, value);
      }}
    />
  );
}
