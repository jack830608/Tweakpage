interface ModeSwitchOption<T extends string> {
  value: T;
  label: string;
}

interface ModeSwitchProps<T extends string> {
  ariaLabel: string;
  options: readonly [ModeSwitchOption<T>, ModeSwitchOption<T>];
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
