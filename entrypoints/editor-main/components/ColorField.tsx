import { useEffect, useState } from 'react';
import { alphaPercent, hexWithoutAlpha, withAlphaPercent } from '../../../lib/css-values';
import { addRecentColor, getRecentColors } from '../../../lib/recent-colors';
import { t } from '../../../lib/i18n';
import type { EditsController } from '../controller';
import { Field } from './Field';
import { EyedropperIcon } from './icons';

interface ColorFieldProps {
  /** The CSS property as the user sees it, e.g. "background-color". */
  name: string;
  property: string;
  controller: EditsController;
  element: Element;
  ariaLabel: string;
  value: string | null;
  onChange: (hex: string) => void;
}

interface EyeDropperResult {
  sRGBHex: string;
}

export function ColorField({
  name,
  property,
  controller,
  element,
  ariaLabel: aria,
  value,
  onChange,
}: ColorFieldProps) {
  const [draft, setDraft] = useState(value ?? '');
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    void getRecentColors().then(setRecent);
  }, []);

  /**
   * Applying and remembering are separate.
   *
   * Every path used to do both, so dragging the alpha slider filed one "recent colour"
   * per step and the list filled with the same colour at forty transparencies. A recent
   * colour is a choice someone made, which is only knowable once they stop adjusting.
   */
  const apply = (hex: string) => onChange(hex);

  const remember = (hex: string) => {
    // Transparency is a property of this use, not of the colour worth keeping.
    void addRecentColor(hexWithoutAlpha(hex)).then(setRecent);
  };

  const eyeDropperCtor = (globalThis as { EyeDropper?: new () => { open: () => Promise<EyeDropperResult> } })
    .EyeDropper;
  const onPick = async () => {
    if (!eyeDropperCtor) return;
    try {
      const { sRGBHex } = await new eyeDropperCtor().open();
      const hex = sRGBHex.toLowerCase();
      setDraft(hex);
      apply(hex);
      remember(hex);
    } catch {
      // user cancelled the eyedropper
    }
  };

  return (
    <>
      <Field name={name} property={property} controller={controller} element={element}>
        <span className="twk-color-field">
          <input
            type="color"
            aria-label={aria}
            data-testid={`${property}-swatch`}
            value={hexWithoutAlpha(value ?? '#ffffff')}
            onChange={(e) => apply(withAlphaPercent(e.target.value, alphaPercent(value ?? '#ffffff')))}
            onBlur={(e) => remember(e.target.value)}
          />
          <input
            type="text"
            aria-label={t('aria_hex', [aria])}
            data-testid={`${property}-hex`}
            placeholder={value === null ? 'none' : undefined}
            value={draft}
            onBlur={() => {
              if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(draft)) remember(draft.toLowerCase());
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              // 8 digits carry the alpha; the picker widget only speaks 6.
              if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(e.target.value)) {
                apply(e.target.value.toLowerCase());
              }
            }}
          />
          {eyeDropperCtor && (
            <button
              type="button"
              aria-label={t('aria_eyedropper', [aria])}
              data-testid={`${property}-eyedropper`}
              title={t('tip_eyedropper')}
              onClick={() => void onPick()}
            >
              <EyedropperIcon />
            </button>
          )}
        </span>
      </Field>
      {/*
        * Always here, disabled when there is no colour to be transparent.
        *
        * It used to appear the moment a hex became valid — which is mid-keystroke, in the
        * field directly above it, pushing the rest of the section down while somebody was
        * typing. A control that is present and inert costs one row; one that arrives
        * costs the reader their place.
        */}
      {(
        <div className="twk-field twk-alpha-row">
          <span aria-hidden="true" />
          <span className="twk-slider-pair">
            <input
              type="range"
              min={0}
              max={100}
              aria-label={t('aria_opacity_slider', [aria])}
              data-testid={`${property}-alpha`}
              value={value === null ? 0 : alphaPercent(value)}
              disabled={value === null}
              // Adjusting transparency is not choosing a colour.
              onChange={(e) => value !== null && apply(withAlphaPercent(value, Number(e.target.value)))}
            />
            <span className="twk-alpha-value">{value === null ? '—' : `${alphaPercent(value)}%`}</span>
          </span>
        </div>
      )}
      {/* Its height is held whether or not there is anything in it yet: it used to arrive
          on the first colour you committed, moving the next field under a cursor already
          on its way there. Same grid as a field row, so the swatches line up under the
          colour inputs instead of being nudged into place with a hard-coded offset. */}
      {(
        <div className="twk-field twk-swatches-row">
          <span aria-hidden="true" />
          <div className="twk-swatches">
            {recent.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t('aria_use_color', [color])}
                title={color}
                style={{ background: color }}
                onClick={() => {
                  setDraft(color);
                  // Already in the list; re-recording it would only reshuffle it under the cursor.
                  apply(color);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
