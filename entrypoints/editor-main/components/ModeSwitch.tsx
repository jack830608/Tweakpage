import type { ReactNode } from 'react';

interface ModeSwitchOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel: string;
}

interface ModeSwitchProps<T extends string> {
  ariaLabel: string;
  options: readonly ModeSwitchOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ModeSwitch<T extends string>({ ariaLabel, options, value, onChange }: ModeSwitchProps<T>) {
  return (
    <div className="pgve-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.ariaLabel}
          data-testid={`mode-${option.value}`}
          aria-pressed={value === option.value}
          className={value === option.value ? 'pgve-segment pgve-segment-active' : 'pgve-segment'}
          onClick={() => {
            if (value !== option.value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
