import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { t } from '../../../lib/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ColorField } from './ColorField';
import { EditsController } from '../controller';

function renderField(onChange: (hex: string) => void) {
  document.body.innerHTML = '<div id="target">Hi</div>';
  const controller = new EditsController(null, document, () => '2026-08-15T10:00:00.000Z');
  render(
    <ColorField
      name="color"
      property="color"
      controller={controller}
      element={document.getElementById('target')!}
      ariaLabel="Color"
      value="#000000"
      onChange={onChange}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fakeBrowser.reset();
  history.replaceState({}, '', '/page');
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
  renderField(onChange);
  fireEvent.click(screen.getByRole('button', { name: t('aria_eyedropper', ['Color']) }));
  await Promise.resolve();
  await Promise.resolve();
  expect(onChange).toHaveBeenCalledWith('#abcdef');
});

test('recent colors render as swatches and apply on click', async () => {
  await fakeBrowser.storage.local.set({ 'tweakpage:recent-colors': ['#112233'] });
  const onChange = vi.fn();
  renderField(onChange);
  const swatch = await screen.findByRole('button', { name: t('aria_use_color', ['#112233']) });
  fireEvent.click(swatch);
  expect(onChange).toHaveBeenCalledWith('#112233');
  // Re-recording it would reshuffle the row under the pointer mid-click.
  const stored = await fakeBrowser.storage.local.get('tweakpage:recent-colors');
  expect(stored['tweakpage:recent-colors']).toEqual(['#112233']);
});

test('a colour is remembered once you are finished choosing it', async () => {
  const onChange = vi.fn();
  renderField(onChange);
  const hex = screen.getByLabelText(t('aria_hex', ['Color']));

  fireEvent.change(hex, { target: { value: '#445566' } });
  await Promise.resolve();
  expect(onChange, 'the page updates while typing').toHaveBeenCalledWith('#445566');
  expect(
    (await fakeBrowser.storage.local.get('tweakpage:recent-colors'))['tweakpage:recent-colors'],
    'but a half-typed colour is not a choice',
  ).toBeUndefined();

  fireEvent.blur(hex);
  await Promise.resolve();
  await Promise.resolve();
  const stored = await fakeBrowser.storage.local.get('tweakpage:recent-colors');
  expect(stored['tweakpage:recent-colors']).toEqual(['#445566']);
});

test('adjusting transparency never fills the list', async () => {
  const onChange = vi.fn();
  renderField(onChange);
  const alpha = screen.getByLabelText(t('aria_opacity_slider', ['Color']));
  for (const percent of ['90', '80', '70', '60']) {
    fireEvent.change(alpha, { target: { value: percent } });
    await Promise.resolve();
  }
  expect(onChange).toHaveBeenCalledTimes(4);
  const stored = await fakeBrowser.storage.local.get('tweakpage:recent-colors');
  expect(stored['tweakpage:recent-colors'], 'transparency is not a colour choice').toBeUndefined();
});

test('a remembered colour drops its transparency', async () => {
  const onChange = vi.fn();
  renderField(onChange);
  const hex = screen.getByLabelText(t('aria_hex', ['Color']));
  fireEvent.change(hex, { target: { value: '#44556680' } });
  fireEvent.blur(hex);
  await Promise.resolve();
  await Promise.resolve();
  const stored = await fakeBrowser.storage.local.get('tweakpage:recent-colors');
  expect(stored['tweakpage:recent-colors']).toEqual(['#445566']);
});
