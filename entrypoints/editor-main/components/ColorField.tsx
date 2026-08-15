import { useEffect, useState, type ReactNode } from 'react';
import { addRecentColor, getRecentColors } from '../../../lib/recent-colors';

interface ColorFieldProps {
  label: string;
  value: string | null;
  onChange: (hex: string) => void;
  trailing?: ReactNode;
}

interface EyeDropperResult {
  sRGBHex: string;
}

export function ColorField({ label, value, onChange, trailing }: ColorFieldProps) {
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
            aria-label={label}
            value={value ?? '#ffffff'}
            onChange={(e) => commit(e.target.value)}
          />
          <input
            type="text"
            aria-label={`${label} hex`}
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
              aria-label={`${label} eyedropper`}
              title="Pick a color from the page"
              onClick={() => void onPick()}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l9.92-9.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12a1 1 0 0 0 .01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z" />
              </svg>
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
