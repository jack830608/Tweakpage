import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ColorField } from './ColorField';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fakeBrowser.reset();
});

test('eyedropper picks a color from the page', async () => {
  vi.stubGlobal(
    'EyeDropper',
    class {
      open() {
        return Promise.resolve({ sRGBHex: '#ABCDEF' });
      }
    },
  );
  const onChange = vi.fn();
  render(<ColorField label="Color" ariaLabel="Color" value="#000000" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Color eyedropper' }));
  await Promise.resolve();
  await Promise.resolve();
  expect(onChange).toHaveBeenCalledWith('#abcdef');
});

test('recent colors render as swatches and apply on click', async () => {
  await fakeBrowser.storage.local.set({ 'tweakpage:recent-colors': ['#112233'] });
  const onChange = vi.fn();
  render(<ColorField label="Color" ariaLabel="Color" value="#000000" onChange={onChange} />);
  const swatch = await screen.findByRole('button', { name: 'Use #112233' });
  fireEvent.click(swatch);
  expect(onChange).toHaveBeenCalledWith('#112233');
});

test('committing a color records it as recent', async () => {
  const onChange = vi.fn();
  render(<ColorField label="Color" ariaLabel="Color" value="#000000" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Color hex'), { target: { value: '#445566' } });
  await Promise.resolve();
  await Promise.resolve();
  const stored = await fakeBrowser.storage.local.get('tweakpage:recent-colors');
  expect(stored['tweakpage:recent-colors']).toEqual(['#445566']);
});
