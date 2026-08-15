import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModeSwitch } from './ModeSwitch';
import { CollapsibleSection } from './CollapsibleSection';

afterEach(cleanup);

const OPTIONS = [
  { value: 'edit', label: 'Edit' },
  { value: 'browse', label: 'Browse' },
] as const;

test('mode switch renders both options and marks the active one', () => {
  render(<ModeSwitch ariaLabel="Interaction mode" options={OPTIONS} value="edit" onChange={() => {}} />);
  expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Browse' }).getAttribute('aria-pressed')).toBe('false');
});

test('clicking the inactive option fires onChange; the active one does not', () => {
  const onChange = vi.fn();
  render(<ModeSwitch ariaLabel="Interaction mode" options={OPTIONS} value="edit" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
  expect(onChange).toHaveBeenCalledWith('browse');
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('collapsible section hides children when closed and toggles', () => {
  const onToggle = vi.fn();
  const { rerender } = render(
    <CollapsibleSection title="Spacing" open={false} onToggle={onToggle}>
      <p>body</p>
    </CollapsibleSection>,
  );
  expect(screen.queryByText('body')).toBeNull();
  expect(screen.getByRole('button', { name: /Spacing/ }).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: /Spacing/ }));
  expect(onToggle).toHaveBeenCalled();
  rerender(
    <CollapsibleSection title="Spacing" open onToggle={onToggle}>
      <p>body</p>
    </CollapsibleSection>,
  );
  expect(screen.getByText('body')).toBeTruthy();
});
