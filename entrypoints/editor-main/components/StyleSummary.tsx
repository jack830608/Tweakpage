import { useSyncExternalStore } from 'react';
import type { EditsController } from '../controller';
import { hasDirectText } from './sections/TextSection';
import { rgbToHex } from '../../../lib/css-values';
import { t } from '../../../lib/i18n';

/**
 * What this element looks like right now, and where to go and change it.
 *
 * It reads and never writes. That is the whole reason it exists in this form rather than
 * as the row of editors it started as: two independent field bindings on one property
 * fight over the draft — one holds what is being typed while the other's synced check
 * fires and clears it — and no arrangement of a second editor avoids that. A summary has
 * no binding, so every property keeps exactly one writer, in the section it already
 * lived in.
 *
 * Pressing a chip opens the group that owns the property and takes you to the real
 * control. One click buys the full row — swatch, hex, eyedropper, alpha — instead of a
 * cell that could only have carried one of them.
 */
export interface RevealRequest {
  /** Groups to open, outermost first. */
  path: string[];
  property: string;
}

interface Chip {
  property: string;
  /** The CSS property to read for display, when it differs from the one edited. */
  read?: string;
  label: string;
  path: string[];
  swatch?: boolean;
}

/**
 * Which four facts are worth stating, per kind of element.
 *
 * A fixed set was the mistake in the first draft of this: font size and weight say
 * nothing about an image, and a bar that empties on half of selections is not a fixed
 * location, it is a special case pretending to be one. A summary is allowed to vary
 * because it is a summary — it describes the element rather than offering the same four
 * controls whatever the element is.
 */
function chipsFor(element: Element): Chip[] {
  const TEXT: Chip[] = [
    { property: 'fontSize', label: t('prop_font_size'), path: ['typography'] },
    { property: 'fontWeight', label: t('prop_font_weight'), path: ['typography'] },
    { property: 'color', label: t('prop_color'), path: ['typography'], swatch: true },
    { property: 'backgroundColor', label: t('prop_background_color'), path: ['box'], swatch: true },
  ];
  if (element.tagName === 'IMG') {
    return [
      { property: 'width', label: t('prop_width'), path: ['box', 'size'] },
      { property: 'height', label: t('prop_height'), path: ['box', 'size'] },
      { property: 'borderRadius', label: t('prop_border_radius'), path: ['box', 'appearance'] },
      { property: 'opacity', label: t('prop_opacity'), path: ['box', 'appearance'] },
    ];
  }
  if (hasDirectText(element)) return TEXT;
  return [
    { property: 'backgroundColor', label: t('prop_background_color'), path: ['box'], swatch: true },
    { property: 'width', label: t('prop_width'), path: ['box', 'size'] },
    { property: 'paddingTop', read: 'padding', label: t('sec_spacing'), path: ['box', 'spacing'] },
    { property: 'borderRadius', label: t('prop_border_radius'), path: ['box', 'appearance'] },
  ];
}

/** Short enough for a 276px row: 12px is 12px, but 0.9285714285714286 is not a fact. */
function readable(value: string): string {
  if (value === '' || value === 'none' || value === 'normal') return '—';
  return value.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100));
}

export function StyleSummary({
  element,
  controller,
  onReveal,
}: {
  element: Element;
  controller: EditsController;
  onReveal: (request: RevealRequest) => void;
}) {
  // The record set is what decides "changed", so the strip has to follow it.
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const computed = getComputedStyle(element);
  const chips = chipsFor(element);

  return (
    <div className="twk-style-summary" data-testid="style-summary">
      {chips.map((chip) => {
        const record = controller.recordFor(element, chip.property);
        const raw = record?.newValue ?? computed.getPropertyValue(
          (chip.read ?? chip.property).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
        );
        // rgbToHex answers #00000000 for rgba(0,0,0,0) and #000000 for the keyword, so a
        // transparent background would paint either an invisible swatch or a black one.
        // Neither is true, and neither is white: an empty box reads as #ffffff, which is
        // a colour somebody may have picked on purpose.
        const hex = chip.swatch ? rgbToHex(raw) : '';
        const nothing =
          chip.swatch &&
          (raw.trim() === '' || raw.trim() === 'transparent' || /^#[0-9a-f]{6}00$/i.test(hex));
        return (
          <button
            type="button"
            key={chip.property}
            className={record ? 'twk-style-chip twk-style-chip--modified' : 'twk-style-chip'}
            data-testid={`summary-${chip.property}`}
            aria-label={t('aria_reveal_property', [chip.label])}
            onClick={() => onReveal({ path: chip.path, property: chip.property })}
          >
            {chip.swatch && (
              <span
                className={nothing ? 'twk-style-swatch twk-style-swatch--none' : 'twk-style-swatch'}
                style={nothing ? undefined : { background: hex }}
                aria-hidden="true"
              />
            )}
            <span className="twk-style-chip-label">{chip.label}</span>
            {!chip.swatch && <span className="twk-style-chip-value">{readable(raw)}</span>}
          </button>
        );
      })}
    </div>
  );
}
