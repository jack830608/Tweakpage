import { useEffect, useState } from 'react';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label>
      {label}
      <span className="pgve-color-field">
        <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          aria-label={`${label} hex`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
        />
      </span>
    </label>
  );
}
