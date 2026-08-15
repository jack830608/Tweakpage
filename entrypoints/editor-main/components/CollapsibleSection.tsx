import type { ReactNode } from 'react';
import { ChevronIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CollapsibleSection({ title, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className="pgve-disclosure">
      <button type="button" className="pgve-disclosure-header" aria-expanded={open} onClick={onToggle}>
        <ChevronIcon open={open} /> {title}
      </button>
      {open && <div className="pgve-disclosure-body">{children}</div>}
    </section>
  );
}
