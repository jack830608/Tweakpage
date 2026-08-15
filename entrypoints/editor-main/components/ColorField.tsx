import { useEffect, useState, type ReactNode } from 'react';
import { addRecentColor, getRecentColors } from '../../../lib/recent-colors';
import { EyedropperIcon } from './icons';

interface ColorFieldProps {
  label: ReactNode;
  ariaLabel: string;
  value: string | null;
  onChange: (hex: string) => void;
  trailing?: ReactNode;
}

interface EyeDropperResult {
  sRGBHex: string;
}

export function ColorField({ label, ariaLabel: aria, value, onChange, trailing }: ColorFieldProps) {
  const [draft, setDraft] = useState(value ?? '');
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    void getRecentColors().then(setRecent);
  }, []);

  const commit = (hex: string) => {
    onChange(hex);
    void addRecentColor(hex).then(setRecent);
  };

  const eyeDropperCtor = (globalThis as { EyeDropper?: new () => { open: () => Promise<EyeDropperResult> } })
    .EyeDropper;
  const onPick = async () => {
    if (!eyeDropperCtor) return;
    try {
      const { sRGBHex } = await new eyeDropperCtor().open();
      const hex = sRGBHex.toLowerCase();
      setDraft(hex);
      commit(hex);
    } catch {
      // user cancelled the eyedropper
    }
  };

  return (
    <>
      <label>
        {label}
        <span className="pgve-color-field">
          <input
            type="color"
            aria-label={aria}
            value={value ?? '#ffffff'}
            onChange={(e) => commit(e.target.value)}
          />
          <input
            type="text"
            aria-label={`${aria} hex`}
            placeholder={value === null ? 'none' : undefined}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (/^#[0-9a-f]{6}$/i.test(e.target.value)) commit(e.target.value.toLowerCase());
            }}
          />
          {eyeDropperCtor && (
            <button
              type="button"
              aria-label={`${aria} eyedropper`}
              title="Pick a color from the page"
              onClick={() => void onPick()}
            >
              <EyedropperIcon />
            </button>
          )}
        </span>
        {trailing}
      </label>
      {recent.length > 0 && (
        <div className="pgve-swatches">
          {recent.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color}`}
              title={color}
              style={{ background: color }}
              onClick={() => {
                setDraft(color);
                commit(color);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
